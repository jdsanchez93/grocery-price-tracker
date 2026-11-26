import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack';
import { AppStack } from '../lib/app-stack';

// Mock NodejsFunction to avoid esbuild bundling — infrastructure tests should not
// depend on api/node_modules being installed.
jest.mock('aws-cdk-lib/aws-lambda-nodejs', () => {
  const actualCdk = jest.requireActual('aws-cdk-lib') as typeof import('aws-cdk-lib');

  class MockNodejsFunction extends actualCdk.aws_lambda.Function {
    constructor(scope: any, id: string, props: any) {
      super(scope, id, {
        runtime: props.runtime ?? actualCdk.aws_lambda.Runtime.NODEJS_22_X,
        handler: props.handler ?? 'index.handler',
        code: actualCdk.aws_lambda.Code.fromInline('// test stub'),
        memorySize: props.memorySize,
        timeout: props.timeout,
        environment: props.environment,
      });
    }
  }

  return {
    NodejsFunction: MockNodejsFunction,
    // Re-export enums referenced via cdk.aws_lambda_nodejs.* in app-stack.ts
    OutputFormat: { CJS: 'cjs', ESM: 'esm' },
  };
});

describe('AppStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
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

  test('Lambda has 512 MB memory and 60s timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 512,
      Timeout: 60,
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

  test('CloudFront default behavior has SPA rewrite function on viewer-request', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: Match.arrayWith([
            Match.objectLike({ EventType: 'viewer-request' }),
          ]),
        }),
      }),
    });
  });

  test('CloudFront distribution has no CustomErrorResponses (API errors pass through)', () => {
    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const distConfig = Object.values(distributions)[0].Properties.DistributionConfig;
    expect(distConfig.CustomErrorResponses).toBeUndefined();
  });

  test('weekly preview-scrape planner schedule is unchanged', () => {
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      Name: 'preview-scrape-planner',
      ScheduleExpression: 'cron(0 9 ? * TUE *)',
      ScheduleExpressionTimezone: 'America/Denver',
    });
  });

  test('live-circular check Lambda has a 10 minute timeout and table access env', () => {
    const fns = template.findResources('AWS::Lambda::Function', {
      Properties: { Timeout: 600 },
    });
    const ids = Object.keys(fns);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^LiveCircularCheckFunction/);
    expect(fns[ids[0]].Properties.Environment.Variables).toMatchObject({
      STAGE: 'prod',
      TABLE_NAME: expect.anything(),
    });
  });

  test('live-circular check runs twice daily in Mountain time, targeting its Lambda', () => {
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      Name: 'live-circular-check',
      ScheduleExpression: 'cron(30 0,12 * * ? *)',
      ScheduleExpressionTimezone: 'America/Denver',
      FlexibleTimeWindow: { Mode: 'OFF' },
      Target: Match.objectLike({
        Arn: { 'Fn::GetAtt': [Match.stringLikeRegexp('^LiveCircularCheckFunction'), 'Arn'] },
        RoleArn: { 'Fn::GetAtt': [Match.stringLikeRegexp('^LiveCheckInvokeRole'), 'Arn'] },
      }),
    });
  });

  test('live-circular check Lambda can write the deals table', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const liveCheckPolicy = Object.entries(policies).find(([, p]) =>
      (p.Properties.Roles as { Ref: string }[]).some((r) => /^LiveCircularCheckFunctionServiceRole/.test(r.Ref)),
    );
    expect(liveCheckPolicy).toBeDefined();
    const actions = (liveCheckPolicy![1].Properties.PolicyDocument.Statement as { Action: string | string[] }[])
      .flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    expect(actions).toEqual(expect.arrayContaining(['dynamodb:PutItem', 'dynamodb:BatchWriteItem', 'ssm:GetParameter']));
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
