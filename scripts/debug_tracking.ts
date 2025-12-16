
import "dotenv/config";
import { storage } from "../server/storage";

async function verifyTracking() {
  console.log("🔍 Checking local database for returns with tracking numbers...");
  const returns = await storage.getReturns();

  const withTracking = returns.filter(r => r.trackingNumber);
  console.log(`Found ${withTracking.length} returns with tracking numbers out of ${returns.length} total.`);

  if (withTracking.length > 0) {
    console.log("Samples:");
    withTracking.slice(0, 5).forEach(r => {
      console.log(`- ${r.returnNumber}: ${r.trackingNumber} (${r.trackingCarrier})`);
    });
  } else {
    console.log("❌ Still no tracking numbers found locally.");
  }

  process.exit(0);
}

verifyTracking();
