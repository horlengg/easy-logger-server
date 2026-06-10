const fs = require('fs');

class FileUtil {
  static writeLogSizeToFile(size, filePath = 'log-size-config.txt') {
    fs.writeFileSync(filePath, String(size), 'utf8');
  }

  static readLogSizeFromFile(filePath = 'log-size-config.txt') {
    if (!fs.existsSync(filePath)) return null;
    return parseInt(fs.readFileSync(filePath, 'utf8').trim(), 10);
  }
}

module.exports = FileUtil;