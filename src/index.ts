module.exports = {
  config: require("./config/loadConfig"),
  backupManager: require("./backup/backupManager"),
  retentionManager: require("./backup/retentionManager"),
};

