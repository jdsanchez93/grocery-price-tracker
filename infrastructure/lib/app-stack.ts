import * as cdk from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
        entry: 'api/src/lambda.ts',
        handler: 'handler',
        runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
    });
  }
}
