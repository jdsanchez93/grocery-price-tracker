import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

interface AppStackProps extends cdk.StackProps {
  dealsTable: dynamodb.ITable;
  appDomainName?: string;
  auth0Domain?: string;
  auth0Audience?: string;
  krogerScope?: string;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // --- S3 bucket for frontend static assets ---
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- Lambda function ---
    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      bundling: {
        format: cdk.aws_lambda_nodejs.OutputFormat.ESM,
        minify: true,
        sourceMap: true,
        target: 'node22',
        forceDockerBundling: false,
        externalModules: ['@aws-sdk/*'],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        STAGE: 'prod',
        TABLE_NAME: props.dealsTable.tableName,
        AUTH0_DOMAIN: props.auth0Domain || '',
        AUTH0_AUDIENCE: props.auth0Audience || '',
        KROGER_SCOPE: props.krogerScope || '',
        LOG_LEVEL: 'info',
      },
    });

    props.dealsTable.grantReadWriteData(apiFunction);

    apiFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/grocery/prod/kroger/client-id`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/grocery/prod/kroger/client-secret`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/grocery/prod/scraper-worker/url`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/grocery/prod/scraper-worker/api-key`,
      ],
    }));

    // --- HTTP API Gateway ---
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['*'],
      },
    });

    const lambdaIntegration = new HttpLambdaIntegration('ApiIntegration', apiFunction);

    httpApi.addRoutes({
      path: '/api',
      methods: [apigwv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // --- ACM Certificate (if custom domain provided) ---
    let certificate: acm.Certificate | undefined;
    if (props.appDomainName) {
      certificate = new acm.Certificate(this, 'AppCertificate', {
        domainName: props.appDomainName,
        validation: acm.CertificateValidation.fromDns(),
      });
    }

    // --- CloudFront OAC for S3 ---
    const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOAC');

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
      originAccessControl: oac,
    });

    // API Gateway origin
    const apiGatewayUrl = `${httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`;
    const apiOrigin = new origins.HttpOrigin(apiGatewayUrl, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // --- CloudFront Function: SPA routing rewrite ---
    // Rewrites non-file paths to /index.html at viewer-request so Angular client-side
    // routing works without distribution-level errorResponses (which would also swallow
    // API 404s from the /api/* behavior).
    const spaRewriteFn = new cloudfront.Function(this, 'SpaRewriteFunction', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.split('/').pop();
  if (lastSegment && lastSegment.includes('.')) {
    return request;
  }
  request.uri = '/index.html';
  return request;
}`.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // --- CloudFront Distribution ---
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{
          function: spaRewriteFn,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      domainNames: props.appDomainName ? [props.appDomainName] : undefined,
      certificate: certificate,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // --- Frontend deployment (only if dist exists) ---
    const frontendDistPath = path.join(__dirname, '../../frontend/dist/frontend/browser');
    if (fs.existsSync(frontendDistPath)) {
      // Hashed JS/CSS assets — cache forever (hash changes on every new build)
      new s3deploy.BucketDeployment(this, 'FrontendAssetsDeployment', {
        sources: [s3deploy.Source.asset(frontendDistPath)],
        destinationBucket: frontendBucket,
        distribution,
        distributionPaths: ['/*'],
        exclude: ['index.html'],
        cacheControl: [
          s3deploy.CacheControl.maxAge(cdk.Duration.days(365)),
          s3deploy.CacheControl.immutable(),
        ],
      });

      // index.html — never cache so browsers always fetch the latest chunk manifest
      new s3deploy.BucketDeployment(this, 'FrontendIndexDeployment', {
        sources: [s3deploy.Source.asset(frontendDistPath)],
        destinationBucket: frontendBucket,
        distribution,
        distributionPaths: ['/index.html'],
        exclude: ['**'],
        include: ['index.html'],
        cacheControl: [
          s3deploy.CacheControl.noCache(),
          s3deploy.CacheControl.noStore(),
          s3deploy.CacheControl.mustRevalidate(),
        ],
      });
    }

    // --- Outputs ---
    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway endpoint URL',
    });

    if (props.appDomainName) {
      new cdk.CfnOutput(this, 'AppDnsRecord', {
        value: `Add CNAME: ${props.appDomainName} → ${distribution.distributionDomainName}`,
        description: 'DNS record to create for custom domain',
      });
    }
  }
}
