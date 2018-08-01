var md = require('markdown-it')();
md.use(require('markdown-it-front-matter'), function(fm) {
    var parsedYaml = yaml.safeLoad(fm);
    page.fm = parsedYaml;
  });
var fs = require('fs');
var yaml = require('js-yaml');

// adapted from https://stackoverflow.com/a/16684530/384316
var walk = function(dir) {
  var results = [];
  var list = fs.readdirSync(dir);
  list.forEach(function(file) {
      if (file[0] === "." || file == "node_modules") return;
      file = dir + '/' + file;
      var stat = fs.statSync(file);
      if (stat && stat.isDirectory()) { 
          /* Recurse into a subdirectory */
          results = results.concat(walk(file));
      } else { 
          /* Is a file */
          if (file.endsWith('.md')) results.push(file);
      }
  });
  return results;
};

var page = {};
var pages = [];

function loadPages() {
  var res = walk(".");
  pages = [];
  res.forEach((file) => {
    page = {};
    
    var text = fs.readFileSync(file, 'utf-8');
    page.raw = text;
  
    var parsedMd = md.parse(text, {});
    page.tokens = parsedMd;
    
    file = file.split('/');
    if (file.length === 3) {
      page.name = file[2].replace('.md', '');
      page.category = file[1];
    }
    else if (file.length === 2) {
      page.name = file[1].replace('.md', '');
    }
    pages.push(page);
  });
  
  var urlDirectory = "\n\n";
  // make url directory
  pages.forEach(page => {
    urlDirectory += `[${page.name}]: ${page.name}.html\n`;
    if (page.fm) {
      if (page.fm.title) urlDirectory += `[${page.fm.title}]: ${page.name}.html\n`;
      if (page.fm.name) urlDirectory += `[${page.fm.name}]: ${page.name}.html\n`;
    }
  });
  
  // use url directory to re-parse
  pages.forEach((page, i, array) => {
    array[i].tokens = md.parse(page.raw + urlDirectory, {});
  });

  // populate title from h1, TODO make optional
  pages.forEach((page) => {
    if (page.title) return;
    var nextToken = false;

    for (var i = 0; i < page.tokens.length; i++) {
      var token = page.tokens[i];
      if (nextToken && token.type === "inline") {
        page.title = token.content;
        break;
      }
      if (token.tag === "h1") nextToken = true;
    }
    
  });
}

function renderPages() {
  // render pages
  console.log("start render");
  pages.forEach(page => {
    console.log(page.name);
    var outFilename = "./html/pages/" + page.name + ".html";
    fs.writeFileSync(outFilename, md.renderer.render(page.tokens, {}));
  });
}

function loadTags() {
  // create tags array
  var tags = [];
  pages.forEach(page => {
    if (page.fm && page.fm.tags) {
      page.fm.tags.forEach(pageTag => {
        var tag = tags.find(t => t.tag === pageTag);
        if (! tag) {
          tag = {tag: pageTag, pages: []};
          tags.push(tag);
        }
        tag.pages.push(page);
      });
    }
  });
  console.log(tags);
}

function getPages() {
  return pages;
}

module.exports = {
  loadPages: loadPages,
  renderPages: renderPages,
  loadTags: loadTags,
  getPages: getPages
};