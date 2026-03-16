import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface PermissionStackProps extends cdk.StackProps {
  dealsTable: dynamodb.ITable;
}

export class PermissionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PermissionStackProps) {
    super(scope, id, props);

    const policy = new iam.ManagedPolicy(this, 'LocalDevDynamoPolicy', {
      description: 'Allows local dev access to the grocery-price-tracker DynamoDB table',
      statements: [
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:BatchWriteItem',
          ],
          resources: [
            props.dealsTable.tableArn,
            `${props.dealsTable.tableArn}/index/*`,
          ],
        }),
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            'arn:aws:ssm:*:*:parameter/grocery/dev/kroger/client-id',
            'arn:aws:ssm:*:*:parameter/grocery/dev/kroger/client-secret',
          ],
        }),
      ],
    });

    new cdk.CfnOutput(this, 'LocalDevPolicyArn', {
      value: policy.managedPolicyArn,
      description: 'Attach this managed policy to your local dev IAM user/role',
    });
  }
}
