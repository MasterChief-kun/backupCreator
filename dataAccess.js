const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const db = new sqlite3.Database("./data/data.sqlite");
const archiver = require("archiver");

function init() {
  if (!fs.existsSync(`${__dirname}/tmp`)) {
    fs.mkdirSync(`${__dirname}/tmp`);
  }
  if (!fs.existsSync(`${__dirname}/tmp/databases`)) {
    fs.mkdirSync(`${__dirname}/tmp/databases`, { recursive: true });
  }
  if (!fs.existsSync(`${__dirname}/tmp/directories`)) {
    fs.mkdirSync(`${__dirname}/tmp/directories`, { recursive: true });
  }
}
function getDate() {
  var currTime = new Date();

  var retString = `${currTime.getDate()}-${currTime.getMonth()}-${currTime.getFullYear()}::${currTime.getHours()}:${currTime.getMinutes()}`;
  return retString;
}
function copyFileSync(source, target) {
  var targetFile = target;

  // If target is a directory, a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target, targetPath) {
  var files = [];

  // Check if folder needs to be created or integrated
  var targetFolder = path.join(target, path.basename(source));
  //var targetFolder = targetPath;
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function (file) {
      var curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

function backupPaths(_callback) {
  db.each("SELECT path from paths", (err, path) => {
    if (err) return console.log(`[ERR] ${err}`);
    var path = path.path;
    if (fs.existsSync(path)) {
      var check = fs.statSync(path);
      console.log("Found path...");
      if (check.isDirectory()) {
        var targetPath = `${__dirname}/tmp/directories/${path
          .split("/")
          .at(-1)}.${getDate()}`;
        fs.mkdirSync(targetPath, { recursive: true });
        copyFolderRecursiveSync(path, targetPath, targetPath);

        console.log(`[D] Copied ${path} into ${targetPath}`);
      } else if (check.isFile()) {
        var targetPath = `${__dirname}/tmp/files/${path.replace(
          "/",
          "%"
        )}.${getDate()}.${path.split(".").at(-1)}`;
        copyFileSync(path, targetPath);

        console.log(`[F] Copied ${path} into ${targetPath}`);
      }
    } else {
      console.log("[ERR] Invalid Path");
    }
  });
  _callback();
}

function backupDB(pass, _callback) {
  db.each("SELECT db from dbs", (err, db) => {
    if (err) return console.log(`[ERR ${err}`);
    if (db.db == "mysql") {
      //            var backupProc = spawnSync(`mysql -u root -p --all-databases > ./tmp/databases/mysqlBackup.${getDate()}.sql`)
      var backupProc = spawn(
        "sh",
        [
          "-c",
          `"mysqldump -u root -p --all-databases --skip-lock-tables > ${__dirname}/tmp/databases/mysqlBackup.${getDate()}.sql"`
        ]
      )
      //var backupProc = spawn("sh",["-c","mysql","-u","root","-p","--all-databases","--skip-lock-tables",">",`${__dirname}/tmp/databases/mysqlBackup.${getDate()}.sql`])
      backupProc.stdin.setDefaultEncoding('utf-8');
      backupProc.stdin.write(pass + "\n");
      backupProc.kill('SIGKILL');
      console.log("[DB] Copied mysql backup to ./tmp/databases");
    } else {
      console.log("[ERR] Database not yet supported or invalid input");
    }
  });
  _callback();
}

function zipBackup(filename) {
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });
  const output = fs.createWriteStream(__dirname + filename);
  output.on("close", function () {
    console.log(archive.pointer() + " total bytes");
    console.log(
      "archiver has been finalized and the output file descriptor has closed."
    );
  });

  output.on("end", function () {
    console.log("Data has been drained");
  });

  archive.pipe(output);

  archive.directory(__dirname + "/tmp", false);
  archive.finalize();
}

module.exports = {
  backupDB,
  backupPaths,
  zipBackup,
  getDate,
  init,
};
