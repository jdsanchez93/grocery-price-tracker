import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack';

describe('StorageStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new StorageStack(app, 'TestStorageStack', { stage: 'test' });
    template = Template.fromStack(stack);
  });

  test('DynamoDB table name is stage-prefixed', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'test-grocery-price-tracker',
    });
  });

  test('billing mode is PAY_PER_REQUEST', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('removal policy is RETAIN', () => {
    template.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });

  test('GSI1 exists with correct key schema and ALL projection', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        }),
      ]),
    });
  });

  test('GSI2 exists with correct key schema and ALL projection', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'entityType', KeyType: 'HASH' },
            { AttributeName: 'weekId', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        }),
      ]),
    });
  });

  test('CfnOutput for TableName exists', () => {
    template.hasOutput('TableName', {});
  });
});
