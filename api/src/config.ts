import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const stage = process.env.STAGE ?? 'dev';
let ssmClient: SSMClient | null = null;

function getSSMClient(): SSMClient {
  if (!ssmClient) ssmClient = new SSMClient({});
  return ssmClient;
}

let krogerCreds: { clientId: string; clientSecret: string } | null = null;

export async function getKrogerCreds(): Promise<{ clientId: string; clientSecret: string }> {
  if (krogerCreds) return krogerCreds;
  const client = getSSMClient();
  const [idRes, secretRes] = await Promise.all([
    client.send(new GetParameterCommand({ Name: `/grocery/${stage}/kroger/client-id` })),
    client.send(new GetParameterCommand({ Name: `/grocery/${stage}/kroger/client-secret`, WithDecryption: true })),
  ]);
  krogerCreds = {
    clientId: idRes.Parameter!.Value!,
    clientSecret: secretRes.Parameter!.Value!,
  };
  return krogerCreds;
}
