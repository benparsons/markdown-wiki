import markdownit from 'markdown-it';
import markdownItFrontMatter from 'markdown-it-front-matter';
import markdownItMissingRefs from 'markdown-it-missing-refs';
import jsYaml from 'js-yaml';
const md = markdownit()
    .use(markdownItFrontMatter, function(fm) {
        entry.fm = jsYaml.loadAll(fm);
    })
    .use(markdownItMissingRefs, function(missing) {
        entry.missing = [];
        for (const linkText of missing) {
            entry.missing.push({linkText:linkText, candidates: []});
        }
    });
import fs from 'fs';

const rootPath = process.argv[2];
const entry = {};
entry.path = process.argv[3];

var walk = function(dir) {
    var results = [];
    var list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            /* Recurse into a subdirectory */
            if (!['.git','node_modules', 'scripts'].includes(file.split("/")[file.split("/").length-1]))
            results = results.concat(walk(file));
        } else { 
            /* Is a file */
            results.push(file);
        }
    });
    return results;
}
const allFiles = walk(rootPath);

console.log(rootPath + " || " + entry.path);

entry.contents = fs.readFileSync(rootPath + "/" + entry.path, "utf-8");

console.log(entry.contents);

const render = md.render(entry.contents);
console.log(render);

console.log(entry.fm);


for (const filePath of allFiles) {
    const candidate = fs.readFileSync(rootPath + "/" + filePath, "utf-8");

    for (const key in entry.missing) {
        if (candidate.match(new RegExp(`^# ${entry.missing[key].linkText}.*`, "gm"))) {
            entry.missing[key].candidates.push(filePath);
        }
    }

}

console.log(entry.missing);
