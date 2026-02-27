const { execSync } = require("child_process");

const run = async (command, cwd) => {
  console.log("-".repeat(80));
  console.log(`Running "${command}" in "${cwd}"`);
  console.log("-".repeat(80));

  execSync(command, {
    cwd: cwd,
    stdio: "inherit",
  });
};

const install = async () => {
  run("npm ci", "./config");

  run("npm ci", "./helpers/fetch-feed");

  run("npm ci", "./helpers/fetch-links");

  run("npm ci", "./webapp");

  run("npm ci", "./server");

  run("npm ci", "./desktop");
};

install();
