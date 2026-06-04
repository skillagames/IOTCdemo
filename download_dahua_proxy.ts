import { writeFileSync } from "fs";
import { request } from "https";
import { parse } from "url";

const targetUrl = "https://upload.wikimedia.org/wikipedia/commons/9/92/Dahua_Technology_logo.svg";
const proxyUrlStr = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
const targetPath = "public/Dahua_logo.svg";

console.log(`Downloading via proxy from: ${proxyUrlStr}`);

const parsedUrl = parse(proxyUrlStr);
const options = {
  hostname: parsedUrl.hostname,
  path: parsedUrl.path,
  method: "GET",
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
  }
};

const req = request(options, (res) => {
  let data = "";
  if (res.statusCode !== 200) {
    console.error(`Failed to download via proxy: Status Code ${res.statusCode}`);
    process.exit(1);
  }

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      if (data.includes("<svg")) {
        writeFileSync(targetPath, data);
        console.log(`Successfully downloaded and saved logo via proxy to ${targetPath}`);
      } else {
        console.error("Downloaded data does not seem to be a valid SVG file.");
        console.log(data.slice(0, 500));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Error saving file: ${err.message}`);
      process.exit(1);
    }
  });
});

req.on("error", (err) => {
  console.error(`HTTP request error: ${err.message}`);
  process.exit(1);
});

req.end();
