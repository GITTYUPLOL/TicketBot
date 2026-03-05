require('dotenv').config();

const db = require('../db');
const { ingestLiveData } = require('../services/liveIngestion');

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    if (arg.startsWith('--country=')) options.countryCode = arg.split('=')[1];
    else if (arg.startsWith('--countries=')) options.countryCodes = arg.split('=')[1];
    else if (arg.startsWith('--categories=')) options.categories = arg.split('=')[1];
    else if (arg.startsWith('--segments=')) options.segmentNames = arg.split('=')[1];
    else if (arg.startsWith('--pages=')) options.maxPages = Number(arg.split('=')[1]);
    else if (arg.startsWith('--size=')) options.size = Number(arg.split('=')[1]);
    else if (arg.startsWith('--days=')) options.daysAhead = Number(arg.split('=')[1]);
    else if (arg.startsWith('--keyword=')) options.keyword = arg.split('=')[1];
    else if (arg.startsWith('--segment=')) options.segmentName = arg.split('=')[1];
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = await db.withEnvironment('live', () => ingestLiveData(options));

  console.log(JSON.stringify(summary, null, 2));

  if (summary.totals.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
