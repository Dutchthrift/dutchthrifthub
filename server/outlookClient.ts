import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableOutlookClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export async function syncEmails() {
  try {
    const client = await getUncachableOutlookClient();
    
    // Get recent emails
    const emails = await client
      .api('/me/messages')
      .top(50)
      .orderby('receivedDateTime desc')
      .get();

    return emails.value;
  } catch (error) {
    console.error('Error syncing emails:', error);
    throw error;
  }
}

export async function getEmailThreads() {
  try {
    const client = await getUncachableOutlookClient();
    
    // Get email conversations (threads)
    const conversations = await client
      .api('/me/mailFolders/inbox/childFolders')
      .get();

    return conversations.value;
  } catch (error) {
    console.error('Error getting email threads:', error);
    throw error;
  }
}

export async function sendEmail(to: string, subject: string, body: string) {
  try {
    const client = await getUncachableOutlookClient();
    
    const message = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: body
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      }
    };

    await client.api('/me/sendMail').post(message);
    
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
