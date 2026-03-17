import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack';
import { PermissionStack } from '../lib/permission-stack';

describe('PermissionStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const storageStack = new StorageStack(app, 'TestStorage', { stage: 'test' });
    const stack = new PermissionStack(app, 'TestPermStack', {
      dealsTable: storageStack.dealsTable,
    });
    template = Template.fromStack(stack);
  });

  test('creates exactly one ManagedPolicy', () => {
    template.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });

  test('policy grants DynamoDB actions on table and index ARNs', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            // arrayWith is sequential — match in array order: GetItem(0), Query(1), PutItem(4)
            Action: Match.arrayWith([
              'dynamodb:GetItem',
              'dynamodb:Query',
              'dynamodb:PutItem',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('policy grants ssm:GetParameter on Kroger credential paths', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            // CDK serializes a single action as a plain string
            Action: 'ssm:GetParameter',
            Effect: 'Allow',
            Resource: Match.arrayWith([
              Match.stringLikeRegexp('kroger/client-id'),
              Match.stringLikeRegexp('kroger/client-secret'),
            ]),
          }),
        ]),
      },
    });
  });
});
