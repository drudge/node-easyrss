/**********************************************************************
 node-easyrss - an RSS parser for node.
 http://github.com/drudge/node-easyrss

 Copyright (c) 2011 Nicholas Penree
 http://penree.com
 
 node-easyrss is released under the MIT license
  - see LICENSE for more info

 Original code:
  Copyright (c) 2010 Rob Searles
  http://www.robsearles.com

 node-rss is released under the MIT license
  - see LICENSE for more info

**********************************************************************/

var request = require('request')
  , xml = require('libxmljs')
  , parseURL = require('url').parse



// The main "meat" of this module - parses an rss feed and triggers
// the callback when done.
var easyParser = function(callback,options) {
  var parser = new xml.SaxParser(function(cb) {
    var articles = Array();
    var current_element = false;
    var article_count = 0;
    var in_item = false;
    var current_chars = '';
    var current_attrs = {};
    
    function processAttributes(attrs) {
      var out = {};
      for(var index in attrs) {
        // key, prefix, uri, value
        var attr = attrs[index];
        out[attr[0]] = attr[3];
      }
      return out;
    }

    cb.onStartDocument(function() { });

    // when finished parsing the RSS feed, trigger the callback
    cb.onEndDocument(function() {
      callback(articles);
    });

    //track what element we are currently in. If it is an <item> this is
    // an article, add container array to the list of articles
    cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
      current_element = elem.toLowerCase();
      current_attrs = processAttributes(attrs);
      if(current_element == 'item' || current_element == 'entry') {
        in_item = true;
        articles[article_count] = Array();

        // fill each item with the custom properties
        for (var key in options) {
          if (typeof  articles[article_count][key] === 'undefined' && key !== 'cb') {
            articles[article_count][key] = options[key];
          }
        }
      }
    });
    
    // when we are at the end of an element, save its related content
    cb.onEndElementNS(function(elem, prefix, uri) {
      if(in_item) {
        switch(current_element) {
          case 'pubdate':
          case 'published':
            articles[article_count][elem] = new Date(current_chars.replace(/^\s\s*/, '').replace(/\s\s*$/, ''));
            break;
          case 'description':
          case 'summary':
            articles[article_count][current_element] = current_chars.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
            break;
          case 'content':
          case 'encoded': // feedburner is <content:encoded>, node-xml reads as <encoded>
            current_element = 'content';
            articles[article_count][current_element] = current_chars.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
            break;
          case 'link':
          case 'title':
            if(current_attrs['href']) {
              articles[article_count][current_element] = current_attrs['href'];
            }
            else if(!prefix) /* Some namespaces use the title element, such as MediaRSS, i.e., media:title */
              articles[article_count][current_element] = current_chars.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
            break;
        }

        current_element = false;
        current_chars = '';
        if(elem.toLowerCase() == 'item' || elem.toString() == 'entry') {
          in_item = false;
          article_count ++;
        }
      }
    });

    cb.onCharacters(addContent);
    cb.onCdata(addContent);
    
    function addContent(chars) {
      if(in_item) {
        current_chars += chars;
      }
    };

    // @TODO handle warnings and errors properly
    cb.onWarning(function(msg) {
      console.log('<WARNING>'+msg+"</WARNING>");
    });
    cb.onError(function(msg) {
      console.log('<ERROR>'+JSON.stringify(msg)+"</ERROR>");
    });
  });

  return parser;
}

/**
 * Parses an RSS feed from a file. 
 *
 * @param file - path to the RSS feed file
 * @param cb - callback function to be triggered at end of parsing
 */

exports.parseFile = function(file, cb) {
  easyParser(cb).parseFile(file);
}

/**
 * Parses an RSS feed from a URL. 
 *
 * @param url - URL of the RSS feed file
 * @param opts - object of objects including callback function to be triggered at end of parsing
 *
 * @TODO - decent error checking
 */

exports.parseURL = function(url, opts) {
  var options={};
  if(typeof opts=="function"){
    options.cb = opts;
  } else { 
    options=opts;
  }

  request(url, function(error, response, body) {
    if (!error) { 
      easyParser(options.cb,options).parseString(body);
    }
  });
};


