import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack';
import { AppStack } from '../lib/app-stack';

describe('AppStack', () => {
  let template: Template;

  beforeAll(() => {
    // Skip asset bundling so tests don't require esbuild to run
    const app = new cdk.App({ context: { '@aws-cdk/core:bundlingStacks': [] } });
    const storageStack = new StorageStack(app, 'TestStorage', { stage: 'test' });
    const stack = new AppStack(app, 'TestAppStack', {
      dealsTable: storageStack.dealsTable,
      auth0Domain: 'test.auth0.com',
      auth0Audience: 'https://test-api',
    });
    template = Template.fromStack(stack);
  });

  test('Lambda uses Node 22 runtime', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
    });
  });

  test('Lambda has 512 MB memory and 30s timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 512,
      Timeout: 30,
    });
  });

  test('Lambda environment has TABLE_NAME, AUTH0_DOMAIN, AUTH0_AUDIENCE', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
          AUTH0_DOMAIN: 'test.auth0.com',
          AUTH0_AUDIENCE: 'https://test-api',
        }),
      },
    });
  });

  test('HTTP API exists with CORS allowing all origins', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'HTTP',
      CorsConfiguration: Match.objectLike({
        AllowOrigins: ['*'],
      }),
    });
  });

  test('API Gateway route /api exists', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'ANY /api',
    });
  });

  test('API Gateway route /api/{proxy+} exists', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'ANY /api/{proxy+}',
    });
  });

  test('CloudFront distribution has /api/* additional behavior', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: '/api/*',
          }),
        ]),
      }),
    });
  });

  test('CloudFront 403 and 404 error responses redirect to /index.html', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
        ]),
      }),
    });
  });

  test('S3 bucket blocks all public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });
});
