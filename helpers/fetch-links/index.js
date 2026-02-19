const { fetchLinksAsync, fetchLinks } = require("./index.node");

module.exports = {
  fetchLinks: fetchLinks || fetchLinksAsync,
  fetchLinksAsync,
};
