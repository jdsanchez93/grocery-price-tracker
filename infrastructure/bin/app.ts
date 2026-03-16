#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { PermissionStack } from '../lib/permission-stack';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';
const Stage = stage.charAt(0).toUpperCase() + stage.slice(1);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const storageStack = new StorageStack(app, `${Stage}-Grocery-StorageStack`, { stage, env });

if (stage === 'dev') {
  new PermissionStack(app, `${Stage}-Grocery-PermissionStack`, {
    dealsTable: storageStack.dealsTable,
    env,
  });
}

if (stage === 'prod') {
  const prodContext = app.node.tryGetContext('prod') || {};
  new AppStack(app, `${Stage}-Grocery-AppStack`, {
    dealsTable: storageStack.dealsTable,
    appDomainName: prodContext.appDomainName,
    auth0Domain: prodContext.auth0Domain,
    auth0Audience: prodContext.auth0Audience,
    env,
  });
}
