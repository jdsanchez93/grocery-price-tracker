import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Single-Table Design
    // Entities: Deal, Store, Circular, Product, User, UserStore
    const groceryDealsTable = new dynamodb.Table(this, 'GroceryDealsTable', {
      tableName: 'GroceryDeals',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI1: Price History
    // Query pattern: Get price history for a product across stores/dates
    // GSI1PK = PRODUCT#<canonicalId>, GSI1SK = <date>#<store>
    groceryDealsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Browse by Week
    // Query pattern: Browse current week's deals by store/department
    // GSI2PK = WEEK#<week>, GSI2SK = STORE#<store>#DEPT#<dept>
    groceryDealsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Auth0 configuration (set via CDK context or environment)
    const auth0Domain = this.node.tryGetContext('auth0Domain') || process.env.AUTH0_DOMAIN || '';
    const auth0Audience = this.node.tryGetContext('auth0Audience') || process.env.AUTH0_AUDIENCE || '';

    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      bundling: {
        // Use local esbuild, never Docker
        forceDockerBundling: false,

        // Minify for smaller bundle size
        minify: true,

        // Tree-shake unused code
        sourceMap: false,

        // Target Node 22
        target: 'node22',

        // Externalize AWS SDK (included in Lambda runtime)
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        TABLE_NAME: groceryDealsTable.tableName,
        AUTH0_DOMAIN: auth0Domain,
        AUTH0_AUDIENCE: auth0Audience,
      },
    });

    // Grant the Lambda function read/write access to the table
    groceryDealsTable.grantReadWriteData(apiFunction);
  }
}
