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

var preCached = [];
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
          if (file.endsWith('.md')) {
            if (pagesCacheMTimeMs && stat.mtimeMs < pagesCacheMTimeMs) {
              preCached.push(file);
            } else {
              results.push(file);
            }
          }
      }
  });
  return results;
};

var page = {};
var pages = [];
var projects = {};
var tags = {};
var pagesCache = {};
var pagesCacheMTimeMs;
try {
  var pagesCacheText = fs.readFileSync(".cache/pagesCache.json", 'utf-8');
  pagesCache = JSON.parse(pagesCacheText);
  pagesCacheMTimeMs = fs.statSync(".cache/pagesCache.json").mtimeMs;
} catch(ex) {
  console.log("pagesCache not loaded");
}


function loadPages(path) {
  pages = [];

  if (! path) path = ".";
  var res = walk(path);

  var hrpagesinstart = process.hrtime()
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

  var hrpagesinend = process.hrtime(hrpagesinstart)
  console.info('Pages in (hr): %ds %dms', hrpagesinend[0], hrpagesinend[1] / 1000000)

  var hrtitlestart = process.hrtime()
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
  var hrtitleend = process.hrtime(hrtitlestart)
  console.info('Title (hr): %ds %dms', hrtitleend[0], hrtitleend[1] / 1000000)

  var hrurldirstart = process.hrtime()
  var urlDirectory = [];
  try {
    var urlDirectoryText = fs.readFileSync(".cache/urlDirectory.txt", 'utf-8');
    urlDirectory = urlDirectoryText.split('\n');
  } catch(ex) {
    console.log("pagesCache not loaded");
  }

  // make url directory
  pages.forEach(page => {
    if (page.fm && page.fm.redirect) {
      return;
    }
    urlDirectory.push(`[${page.name}]: ${page.name}`);
    if (page.fm) {
      if (page.title &&
        !(page.title.includes('[') || page.title.includes(']'))) {
        urlDirectory.push(`[${page.title}]: ${page.name}\n`);
      }
      if (page.fm.name) urlDirectory.push(`[${page.fm.name}]: ${page.name}\n`);
    }
  });
  // append redirects to url directory
  pages.filter(p=>p.fm&&p.fm.redirect).forEach(redirectPage => {
    const destination = pages.find(p => p.title === redirectPage.fm.redirect);
    if (destination) {
      urlDirectory.push(`[${redirectPage.name}]: ${destination.name}`);
      if (redirectPage.title && !(   redirectPage.title.includes('[') || redirectPage.title.includes(']')   )) {
        urlDirectory.push(`[${redirectPage.title}]: ${destination.name}`);
      }
    }
  });
  fs.writeFileSync(".cache/urlDirectory.txt", urlDirectory.join('\n'));
  var hrurldirend = process.hrtime(hrurldirstart)
  console.info('Url dir (hr): %ds %dms', hrurldirend[0], hrurldirend[1] / 1000000)

  var hrreparsestart = process.hrtime()
  // use url directory to re-parse
  pages.forEach((repage, i, array) => {
    var pageDirectory = `\n\n`;
    if (repage.missing) {
      repage.missing.forEach(missing => {
        pageDirectory += urlDirectory.filter(ud => ud.toLowerCase().includes(`[${missing.toLowerCase()}]`)).join(`\n`);
        if (pageDirectory[pageDirectory.length-1] !== `\n`) pageDirectory += `\n`;
      });
    }
    array[i].tokens = md.parse(repage.raw + pageDirectory, {});
    array[i].html = md.renderer.render(array[i].tokens, {});
    array[i].missing = page.missing;
    page.missing = [];
    pagesCache[repage.path] = array[i];
  });
  var hrreparseend = process.hrtime(hrreparsestart)
  console.info('reparse (hr): %ds %dms', hrreparseend[0], hrreparseend[1] / 1000000)

  var hrprecachestart = process.hrtime()
  preCached.forEach(file => {
    pages.push(pagesCache[file]);
  });
  var hrprecacheend = process.hrtime(hrprecachestart)
  console.info('precache fill (hr): %ds %dms', hrprecacheend[0], hrprecacheend[1] / 1000000)


  fs.writeFileSync(".cache/pagesCache.json", JSON.stringify(pagesCache));
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
  tags = {};
  
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
    console.log(`Pages not loaded. ${pages.length}`);
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