#!/usr/bin/env node
/**
 * Created by lawrencelaw on 10/11/2015.
 */
var program = require('commander');
var fs = require('fs');
var _ = require('underscore');
var SpellChecker = require('hunspell-spellchecker');
var start = new Date();

program
  .version('1.0.0')
  .option('-p, --pretty', 'Pretty Formatted JSON in the outputs', false)
  .option('-m, --metadata', 'Generate Metadata', false)
  .option('-s, --spell', 'Enable Spell Checker', false)
  .arguments('<cmd> <output> <dictionaryPath>')
  .action(function (cmd, output, dictionaryPath) {
    cmdValue = cmd;
    dictionaryPathValue = dictionaryPath;
    outputValue = output;
  });

program.parse(process.argv);

// Init Dictionary Buffer
var spellchecker_US = new SpellChecker();
var spellchecker_UK = new SpellChecker();
/**
 * Serialize the hunspell data
 * @param callback
 */
function InitDic(callback) {

  var DICT_US = spellchecker_US.parse({
    aff: fs.readFileSync(dictionaryPathValue + "/en_US.aff"),
    dic: fs.readFileSync(dictionaryPathValue + "/en_US.dic")
  });

  var DICT_UK = spellchecker_UK.parse({
    aff: fs.readFileSync(dictionaryPathValue + "/en_GB.aff"),
    dic: fs.readFileSync(dictionaryPathValue + "/en_GB.dic")
  });

  callback && callback(DICT_US, DICT_UK);
}
// End Init Dictionary Buffer

/**
 * File Reader
 * @param callback   Result Exported For Downstream Processing
 */
function readfile(callback) {
  fs.readFile(cmdValue, 'utf8', function (err, data) {
    if (err) {
      callback && callback(err);
    } else {
      var dir = './' + outputValue;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      callback && callback(data);
    }
  });
}

/**
 * Upstream Result Parser
 * @param entry     Loaded JSON
 * @param DICT_US   Serialized US Dictionary
 * @param DICT_UK   Serialized UK Dictionary
 * @param callback  Output
 */
function parseFile(entry, DICT_US, DICT_UK, callback) {
  if (JSON.parse(JSON.stringify(entry)).errno) {
    console.error(JSON.parse(JSON.stringify(entry)).code);
    process.exit(1);
  } else {
    var data = JSON.parse(entry);

    if (program.spell) {
      spellchecker_US.use(DICT_US);
      spellchecker_UK.use(DICT_UK);
      var checking = _.mapObject(data, function (d, k) {
        if (k.match(/^[A-Z]+$/i) && k.length > 1 && (spellchecker_US.check(k) || spellchecker_UK.check(k))) {
          return {
            lemma: k,
            exist: _.map(d, function (e) {
              return {
                path: e
              }
            })
          }
        } else {
          return false;
        }
      });

      var rejecting = _.reject(checking, function (d) {
        return d == false
      });

      callback && callback(rejecting);
    } else {
      var checked = _.mapObject(data, function (d, k) {
        if (k.match(/^[A-Z]+$/i) && k.length > 1) {
          return {
            lemma: k,
            exist: _.map(d, function (e) {
              return {
                path: e
              }
            })
          }
        } else {
          return false;
        }
      });

      var rejected = _.reject(checked, function (d) {
        return d == false
      });

      callback && callback(rejected);
    }
  }
}

function writeFile(entry, callback) {
  var cnt = 0;
  entry.forEach(function (v) {
    fs.writeFile('./' + outputValue + '/' + v.lemma + '.json', JSON.stringify(v.exist, null, 2), 'utf8', function (err) {
      if (err) {
        throw err
      }
    });
    cnt = cnt + 1;
  });

  callback && callback(cnt);
}

InitDic(function (DICT_US, DICT_UK) {
  readfile(function (result) {
    parseFile(result, DICT_US, DICT_UK, function (output) {
      writeFile(output, function (callback) {
        var end = new Date() - start;
        console.info(callback + " Files Generated");
        console.info("Execution time: %dms", end);
      })
    })
  })
});
