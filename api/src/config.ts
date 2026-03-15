import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const stage = process.env.STAGE ?? 'dev';
const ssmClient = new SSMClient({});

let krogerCreds: { clientId: string; clientSecret: string } | null = null;

export async function getKrogerCreds(): Promise<{ clientId: string; clientSecret: string }> {
  if (krogerCreds) return krogerCreds;
  const [idRes, secretRes] = await Promise.all([
    ssmClient.send(new GetParameterCommand({ Name: `/grocery/${stage}/kroger/client-id` })),
    ssmClient.send(new GetParameterCommand({ Name: `/grocery/${stage}/kroger/client-secret`, WithDecryption: true })),
  ]);
  krogerCreds = {
    clientId: idRes.Parameter!.Value!,
    clientSecret: secretRes.Parameter!.Value!,
  };
  return krogerCreds;
}
