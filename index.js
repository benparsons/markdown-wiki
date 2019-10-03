var md = require('markdown-it')();
md.use(require('markdown-it-front-matter'), function(fm) {
    var parsedYaml = yaml.safeLoad(fm);
    page.fm = parsedYaml;
  });
md.use(require('markdown-it-missing-refs'), function(missing) {
    page.missing = missing;
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
var projects = {};
var tags = {};

function loadPages(path) {

  if (! path) path = ".";
  var res = walk(path);
  pages = [];
  res.forEach((file) => {
    page = {};
    
    var text = fs.readFileSync(file, 'utf-8');
    page.raw = text;
  
    var parsedMd = md.parse(text, {});
    page.tokens = parsedMd;
    
    page.path = file;
    file = file.split('/');
    page.name = file[file.length - 1].replace('.md', '');
    // if (file.length === 3) {
    //   page.name = file[2].replace('.md', '');
    //   page.category = file[1];
    // }
    // else if (file.length === 2) {
    //   page.name = file[1].replace('.md', '');
    // }
    pages.push(page);
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
  
  var urlDirectory = [];
  // make url directory
  pages.forEach(page => {
    urlDirectory.push(`[${page.name}]: ${page.name}.html`);
    if (page.fm) {
      if (page.title &&
        !(page.title.includes('[') || page.title.includes(']'))) {
        urlDirectory.push(`[${page.title}]: ${page.name}.html\n`);
      }
      if (page.fm.name) urlDirectory.push(`[${page.fm.name}]: ${page.name}.html\n`);
    }
  });
  // append redirects to url directory
  pages.filter(p=>p.fm&&p.fm.redirect).forEach(redirectPage => {
    const destination = pages.find(p => p.title === redirectPage.fm.redirect);
    if (destination) {
      urlDirectory.push(`[${redirectPage.name}]: ${destination.name}.html`);
      if (redirectPage.title && !(   redirectPage.title.includes('[') || redirectPage.title.includes(']')   )) {
        urlDirectory.push(`[${redirectPage.title}]: ${destination.name}.html`);
      }
    }
  });

  // use url directory to re-parse
  pages.forEach((repage, i, array) => {
    var pageDirectory = `\n\n`;
    if (repage.missing) {
      repage.missing.forEach(missing => {
        pageDirectory += urlDirectory.filter(ud => ud.indexOf(`[${missing}]`) !== -1).join(`\n`);
        if (pageDirectory[pageDirectory.length-1] !== `\n`) pageDirectory += `\n`;
      });
    }
    array[i].tokens = md.parse(repage.raw + pageDirectory, {});
    array[i].html = md.renderer.render(array[i].tokens, {});
    array[i].missing = page.missing;
    page.missing = [];
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
  pages.forEach(page => {
    if (page.fm && page.fm.tags) {
      page.fm.tags.forEach(pageTag => {
        if (! tags[pageTag]) {
          tags[pageTag] = [];
        }
        tags[pageTag].push({
          name: page.name,
          title: page.title
        });
      });
    }
  });
}

function loadProjects() {
  projects = {};

  if (! pages || pages.length === 0) {
    console.log("Pages not loaded.");
    return;
  }

  pages.forEach(page => {
    if (page.fm && page.fm.project) {
      if (! page.fm.task.status) return;
      if (page.fm.task.status.toLowerCase() === "done" ) return;
      if (! projects[page.fm.project]) { 
        projects[page.fm.project] = [];
      }
      projects[page.fm.project].push({
        name: page.name,
        title: page.title,
        category: page.category
      });
    }
  });
}

function getPages() {
  return pages;
}

function getWiki() {
  return {
    pages: pages,
    projects: projects,
    tags: tags
  };
}

function writeFrontMatter(name, json) {
  var entry = pages.find(x => x.name === name);
  var frontMatter = yaml.dump(json, {noArrayIndent: true});
  frontMatter = frontMatter.replace(/(date: \d\d\d\d-\d\d-\d\d).*/, "$1");
  console.log(frontMatter);
  var output = entry.raw.replace(/---(.|[\r\n])*---/, `---\n${frontMatter}---`);
  process.chdir(__dirname + "/../..");
  fs.writeFileSync(entry.path, output);
}

module.exports = {
  loadPages: loadPages,
  renderPages: renderPages,
  loadTags: loadTags,
  getPages: getPages,
  loadProjects: loadProjects,
  getWiki, getWiki,
  writeFrontMatter: writeFrontMatter
};