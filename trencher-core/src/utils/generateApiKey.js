import crypto from 'crypto';

export function generateApiKey() {
  return 'autr_' + crypto.randomBytes(24).toString('hex');
}

// Run directly from command line to quickly output a generated key
if (process.argv[1]?.endsWith('generateApiKey.js') || process.argv[1]?.endsWith('generateApiKey')) {
  console.log('--------------------------------------------------');
  console.log('NEW AUTR API KEY GENERATED:');
  console.log(generateApiKey());
  console.log('--------------------------------------------------');
}
