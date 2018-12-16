(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/* Riot v3.13.2, @license MIT */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.riot = {})));
}(this, (function (exports) { 'use strict';

  /**
   * Shorter and fast way to select a single node in the DOM
   * @param   { String } selector - unique dom selector
   * @param   { Object } ctx - DOM node where the target of our search will is located
   * @returns { Object } dom node found
   */
  function $(selector, ctx) {
    return (ctx || document).querySelector(selector)
  }

  var
    // be aware, internal usage
    // ATTENTION: prefix the global dynamic variables with `__`
    // tags instances cache
    __TAGS_CACHE = [],
    // tags implementation cache
    __TAG_IMPL = {},
    YIELD_TAG = 'yield',

    /**
     * Const
     */
    GLOBAL_MIXIN = '__global_mixin',

    // riot specific prefixes or attributes
    ATTRS_PREFIX = 'riot-',

    // Riot Directives
    REF_DIRECTIVES = ['ref', 'data-ref'],
    IS_DIRECTIVE = 'data-is',
    CONDITIONAL_DIRECTIVE = 'if',
    LOOP_DIRECTIVE = 'each',
    LOOP_NO_REORDER_DIRECTIVE = 'no-reorder',
    SHOW_DIRECTIVE = 'show',
    HIDE_DIRECTIVE = 'hide',
    KEY_DIRECTIVE = 'key',
    RIOT_EVENTS_KEY = '__riot-events__',

    // for typeof == '' comparisons
    T_STRING = 'string',
    T_OBJECT = 'object',
    T_UNDEF  = 'undefined',
    T_FUNCTION = 'function',

    XLINK_NS = 'http://www.w3.org/1999/xlink',
    SVG_NS = 'http://www.w3.org/2000/svg',
    XLINK_REGEX = /^xlink:(\w+)/,

    WIN = typeof window === T_UNDEF ? /* istanbul ignore next */ undefined : window,

    // special native tags that cannot be treated like the others
    RE_SPECIAL_TAGS = /^(?:t(?:body|head|foot|[rhd])|caption|col(?:group)?|opt(?:ion|group))$/,
    RE_SPECIAL_TAGS_NO_OPTION = /^(?:t(?:body|head|foot|[rhd])|caption|col(?:group)?)$/,
    RE_EVENTS_PREFIX = /^on/,
    RE_HTML_ATTRS = /([-\w]+) ?= ?(?:"([^"]*)|'([^']*)|({[^}]*}))/g,
    // some DOM attributes must be normalized
    CASE_SENSITIVE_ATTRIBUTES = {
      'viewbox': 'viewBox',
      'preserveaspectratio': 'preserveAspectRatio'
    },
    /**
     * Matches boolean HTML attributes in the riot tag definition.
     * With a long list like this, a regex is faster than `[].indexOf` in most browsers.
     * @const {RegExp}
     * @see [attributes.md](https://github.com/riot/compiler/blob/dev/doc/attributes.md)
     */
    RE_BOOL_ATTRS = /^(?:disabled|checked|readonly|required|allowfullscreen|auto(?:focus|play)|compact|controls|default|formnovalidate|hidden|ismap|itemscope|loop|multiple|muted|no(?:resize|shade|validate|wrap)?|open|reversed|seamless|selected|sortable|truespeed|typemustmatch)$/,
    // version# for IE 8-11, 0 for others
    IE_VERSION = (WIN && WIN.document || /* istanbul ignore next */ {}).documentMode | 0;

  /**
   * Create a generic DOM node
   * @param   { String } name - name of the DOM node we want to create
   * @returns { Object } DOM node just created
   */
  function makeElement(name) {
    return name === 'svg' ? document.createElementNS(SVG_NS, name) : document.createElement(name)
  }

  /**
   * Set any DOM attribute
   * @param { Object } dom - DOM node we want to update
   * @param { String } name - name of the property we want to set
   * @param { String } val - value of the property we want to set
   */
  function setAttribute(dom, name, val) {
    var xlink = XLINK_REGEX.exec(name);
    if (xlink && xlink[1])
      { dom.setAttributeNS(XLINK_NS, xlink[1], val); }
    else
      { dom.setAttribute(name, val); }
  }

  var styleNode;
  // Create cache and shortcut to the correct property
  var cssTextProp;
  var byName = {};
  var needsInject = false;

  // skip the following code on the server
  if (WIN) {
    styleNode = ((function () {
      // create a new style element with the correct type
      var newNode = makeElement('style');
      // replace any user node or insert the new one into the head
      var userNode = $('style[type=riot]');

      setAttribute(newNode, 'type', 'text/css');
      /* istanbul ignore next */
      if (userNode) {
        if (userNode.id) { newNode.id = userNode.id; }
        userNode.parentNode.replaceChild(newNode, userNode);
      } else { document.head.appendChild(newNode); }

      return newNode
    }))();
    cssTextProp = styleNode.styleSheet;
  }

  /**
   * Object that will be used to inject and manage the css of every tag instance
   */
  var styleManager = {
    styleNode: styleNode,
    /**
     * Save a tag style to be later injected into DOM
     * @param { String } css - css string
     * @param { String } name - if it's passed we will map the css to a tagname
     */
    add: function add(css, name) {
      byName[name] = css;
      needsInject = true;
    },
    /**
     * Inject all previously saved tag styles into DOM
     * innerHTML seems slow: http://jsperf.com/riot-insert-style
     */
    inject: function inject() {
      if (!WIN || !needsInject) { return }
      needsInject = false;
      var style = Object.keys(byName)
        .map(function (k) { return byName[k]; })
        .join('\n');
      /* istanbul ignore next */
      if (cssTextProp) { cssTextProp.cssText = style; }
      else { styleNode.innerHTML = style; }
    },

    /**
     * Remove a tag style of injected DOM later.
     * @param {String} name a registered tagname
     */
    remove: function remove(name) {
      delete byName[name];
      needsInject = true;
    }
  };

  /**
   * The riot template engine
   * @version v3.0.8
   */

  /* istanbul ignore next */
  var skipRegex = (function () { //eslint-disable-line no-unused-vars

    var beforeReChars = '[{(,;:?=|&!^~>%*/';

    var beforeReWords = [
      'case',
      'default',
      'do',
      'else',
      'in',
      'instanceof',
      'prefix',
      'return',
      'typeof',
      'void',
      'yield'
    ];

    var wordsLastChar = beforeReWords.reduce(function (s, w) {
      return s + w.slice(-1)
    }, '');

    var RE_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:(?:\\.|\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/[gimuy]*/;
    var RE_VN_CHAR = /[$\w]/;

    function prev (code, pos) {
      while (--pos >= 0 && /\s/.test(code[pos])){ }
      return pos
    }

    function _skipRegex (code, start) {

      var re = /.*/g;
      var pos = re.lastIndex = start++;
      var match = re.exec(code)[0].match(RE_REGEX);

      if (match) {
        var next = pos + match[0].length;

        pos = prev(code, pos);
        var c = code[pos];

        if (pos < 0 || ~beforeReChars.indexOf(c)) {
          return next
        }

        if (c === '.') {

          if (code[pos - 1] === '.') {
            start = next;
          }

        } else if (c === '+' || c === '-') {

          if (code[--pos] !== c ||
              (pos = prev(code, pos)) < 0 ||
              !RE_VN_CHAR.test(code[pos])) {
            start = next;
          }

        } else if (~wordsLastChar.indexOf(c)) {

          var end = pos + 1;

          while (--pos >= 0 && RE_VN_CHAR.test(code[pos])){ }
          if (~beforeReWords.indexOf(code.slice(pos + 1, end))) {
            start = next;
          }
        }
      }

      return start
    }

    return _skipRegex

  })();

  /**
   * riot.util.brackets
   *
   * - `brackets    ` - Returns a string or regex based on its parameter
   * - `brackets.set` - Change the current riot brackets
   *
   * @module
   */

  /* global riot */

  /* istanbul ignore next */
  var brackets = (function (UNDEF) {

    var
      REGLOB = 'g',

      R_MLCOMMS = /\/\*[^*]*\*+(?:[^*\/][^*]*\*+)*\//g,

      R_STRINGS = /"[^"\\]*(?:\\[\S\s][^"\\]*)*"|'[^'\\]*(?:\\[\S\s][^'\\]*)*'|`[^`\\]*(?:\\[\S\s][^`\\]*)*`/g,

      S_QBLOCKS = R_STRINGS.source + '|' +
        /(?:\breturn\s+|(?:[$\w\)\]]|\+\+|--)\s*(\/)(?![*\/]))/.source + '|' +
        /\/(?=[^*\/])[^[\/\\]*(?:(?:\[(?:\\.|[^\]\\]*)*\]|\\.)[^[\/\\]*)*?([^<]\/)[gim]*/.source,

      UNSUPPORTED = RegExp('[\\' + 'x00-\\x1F<>a-zA-Z0-9\'",;\\\\]'),

      NEED_ESCAPE = /(?=[[\]()*+?.^$|])/g,

      S_QBLOCK2 = R_STRINGS.source + '|' + /(\/)(?![*\/])/.source,

      FINDBRACES = {
        '(': RegExp('([()])|'   + S_QBLOCK2, REGLOB),
        '[': RegExp('([[\\]])|' + S_QBLOCK2, REGLOB),
        '{': RegExp('([{}])|'   + S_QBLOCK2, REGLOB)
      },

      DEFAULT = '{ }';

    var _pairs = [
      '{', '}',
      '{', '}',
      /{[^}]*}/,
      /\\([{}])/g,
      /\\({)|{/g,
      RegExp('\\\\(})|([[({])|(})|' + S_QBLOCK2, REGLOB),
      DEFAULT,
      /^\s*{\^?\s*([$\w]+)(?:\s*,\s*(\S+))?\s+in\s+(\S.*)\s*}/,
      /(^|[^\\]){=[\S\s]*?}/
    ];

    var
      cachedBrackets = UNDEF,
      _regex,
      _cache = [],
      _settings;

    function _loopback (re) { return re }

    function _rewrite (re, bp) {
      if (!bp) { bp = _cache; }
      return new RegExp(
        re.source.replace(/{/g, bp[2]).replace(/}/g, bp[3]), re.global ? REGLOB : ''
      )
    }

    function _create (pair) {
      if (pair === DEFAULT) { return _pairs }

      var arr = pair.split(' ');

      if (arr.length !== 2 || UNSUPPORTED.test(pair)) {
        throw new Error('Unsupported brackets "' + pair + '"')
      }
      arr = arr.concat(pair.replace(NEED_ESCAPE, '\\').split(' '));

      arr[4] = _rewrite(arr[1].length > 1 ? /{[\S\s]*?}/ : _pairs[4], arr);
      arr[5] = _rewrite(pair.length > 3 ? /\\({|})/g : _pairs[5], arr);
      arr[6] = _rewrite(_pairs[6], arr);
      arr[7] = RegExp('\\\\(' + arr[3] + ')|([[({])|(' + arr[3] + ')|' + S_QBLOCK2, REGLOB);
      arr[8] = pair;
      return arr
    }

    function _brackets (reOrIdx) {
      return reOrIdx instanceof RegExp ? _regex(reOrIdx) : _cache[reOrIdx]
    }

    _brackets.split = function split (str, tmpl, _bp) {
      // istanbul ignore next: _bp is for the compiler
      if (!_bp) { _bp = _cache; }

      var
        parts = [],
        match,
        isexpr,
        start,
        pos,
        re = _bp[6];

      var qblocks = [];
      var prevStr = '';
      var mark, lastIndex;

      isexpr = start = re.lastIndex = 0;

      while ((match = re.exec(str))) {

        lastIndex = re.lastIndex;
        pos = match.index;

        if (isexpr) {

          if (match[2]) {

            var ch = match[2];
            var rech = FINDBRACES[ch];
            var ix = 1;

            rech.lastIndex = lastIndex;
            while ((match = rech.exec(str))) {
              if (match[1]) {
                if (match[1] === ch) { ++ix; }
                else if (!--ix) { break }
              } else {
                rech.lastIndex = pushQBlock(match.index, rech.lastIndex, match[2]);
              }
            }
            re.lastIndex = ix ? str.length : rech.lastIndex;
            continue
          }

          if (!match[3]) {
            re.lastIndex = pushQBlock(pos, lastIndex, match[4]);
            continue
          }
        }

        if (!match[1]) {
          unescapeStr(str.slice(start, pos));
          start = re.lastIndex;
          re = _bp[6 + (isexpr ^= 1)];
          re.lastIndex = start;
        }
      }

      if (str && start < str.length) {
        unescapeStr(str.slice(start));
      }

      parts.qblocks = qblocks;

      return parts

      function unescapeStr (s) {
        if (prevStr) {
          s = prevStr + s;
          prevStr = '';
        }
        if (tmpl || isexpr) {
          parts.push(s && s.replace(_bp[5], '$1'));
        } else {
          parts.push(s);
        }
      }

      function pushQBlock(_pos, _lastIndex, slash) { //eslint-disable-line
        if (slash) {
          _lastIndex = skipRegex(str, _pos);
        }

        if (tmpl && _lastIndex > _pos + 2) {
          mark = '\u2057' + qblocks.length + '~';
          qblocks.push(str.slice(_pos, _lastIndex));
          prevStr += str.slice(start, _pos) + mark;
          start = _lastIndex;
        }
        return _lastIndex
      }
    };

    _brackets.hasExpr = function hasExpr (str) {
      return _cache[4].test(str)
    };

    _brackets.loopKeys = function loopKeys (expr) {
      var m = expr.match(_cache[9]);

      return m
        ? { key: m[1], pos: m[2], val: _cache[0] + m[3].trim() + _cache[1] }
        : { val: expr.trim() }
    };

    _brackets.array = function array (pair) {
      return pair ? _create(pair) : _cache
    };

    function _reset (pair) {
      if ((pair || (pair = DEFAULT)) !== _cache[8]) {
        _cache = _create(pair);
        _regex = pair === DEFAULT ? _loopback : _rewrite;
        _cache[9] = _regex(_pairs[9]);
      }
      cachedBrackets = pair;
    }

    function _setSettings (o) {
      var b;

      o = o || {};
      b = o.brackets;
      Object.defineProperty(o, 'brackets', {
        set: _reset,
        get: function () { return cachedBrackets },
        enumerable: true
      });
      _settings = o;
      _reset(b);
    }

    Object.defineProperty(_brackets, 'settings', {
      set: _setSettings,
      get: function () { return _settings }
    });

    /* istanbul ignore next: in the browser riot is always in the scope */
    _brackets.settings = typeof riot !== 'undefined' && riot.settings || {};
    _brackets.set = _reset;
    _brackets.skipRegex = skipRegex;

    _brackets.R_STRINGS = R_STRINGS;
    _brackets.R_MLCOMMS = R_MLCOMMS;
    _brackets.S_QBLOCKS = S_QBLOCKS;
    _brackets.S_QBLOCK2 = S_QBLOCK2;

    return _brackets

  })();

  /**
   * @module tmpl
   *
   * tmpl          - Root function, returns the template value, render with data
   * tmpl.hasExpr  - Test the existence of a expression inside a string
   * tmpl.loopKeys - Get the keys for an 'each' loop (used by `_each`)
   */

  /* istanbul ignore next */
  var tmpl = (function () {

    var _cache = {};

    function _tmpl (str, data) {
      if (!str) { return str }

      return (_cache[str] || (_cache[str] = _create(str))).call(
        data, _logErr.bind({
          data: data,
          tmpl: str
        })
      )
    }

    _tmpl.hasExpr = brackets.hasExpr;

    _tmpl.loopKeys = brackets.loopKeys;

    // istanbul ignore next
    _tmpl.clearCache = function () { _cache = {}; };

    _tmpl.errorHandler = null;

    function _logErr (err, ctx) {

      err.riotData = {
        tagName: ctx && ctx.__ && ctx.__.tagName,
        _riot_id: ctx && ctx._riot_id  //eslint-disable-line camelcase
      };

      if (_tmpl.errorHandler) { _tmpl.errorHandler(err); }
      else if (
        typeof console !== 'undefined' &&
        typeof console.error === 'function'
      ) {
        console.error(err.message);
        console.log('<%s> %s', err.riotData.tagName || 'Unknown tag', this.tmpl); // eslint-disable-line
        console.log(this.data); // eslint-disable-line
      }
    }

    function _create (str) {
      var expr = _getTmpl(str);

      if (expr.slice(0, 11) !== 'try{return ') { expr = 'return ' + expr; }

      return new Function('E', expr + ';')    // eslint-disable-line no-new-func
    }

    var RE_DQUOTE = /\u2057/g;
    var RE_QBMARK = /\u2057(\d+)~/g;

    function _getTmpl (str) {
      var parts = brackets.split(str.replace(RE_DQUOTE, '"'), 1);
      var qstr = parts.qblocks;
      var expr;

      if (parts.length > 2 || parts[0]) {
        var i, j, list = [];

        for (i = j = 0; i < parts.length; ++i) {

          expr = parts[i];

          if (expr && (expr = i & 1

              ? _parseExpr(expr, 1, qstr)

              : '"' + expr
                  .replace(/\\/g, '\\\\')
                  .replace(/\r\n?|\n/g, '\\n')
                  .replace(/"/g, '\\"') +
                '"'

            )) { list[j++] = expr; }

        }

        expr = j < 2 ? list[0]
             : '[' + list.join(',') + '].join("")';

      } else {

        expr = _parseExpr(parts[1], 0, qstr);
      }

      if (qstr.length) {
        expr = expr.replace(RE_QBMARK, function (_, pos) {
          return qstr[pos]
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
        });
      }
      return expr
    }

    var RE_CSNAME = /^(?:(-?[_A-Za-z\xA0-\xFF][-\w\xA0-\xFF]*)|\u2057(\d+)~):/;
    var
      RE_BREND = {
        '(': /[()]/g,
        '[': /[[\]]/g,
        '{': /[{}]/g
      };

    function _parseExpr (expr, asText, qstr) {

      expr = expr
        .replace(/\s+/g, ' ').trim()
        .replace(/\ ?([[\({},?\.:])\ ?/g, '$1');

      if (expr) {
        var
          list = [],
          cnt = 0,
          match;

        while (expr &&
              (match = expr.match(RE_CSNAME)) &&
              !match.index
          ) {
          var
            key,
            jsb,
            re = /,|([[{(])|$/g;

          expr = RegExp.rightContext;
          key  = match[2] ? qstr[match[2]].slice(1, -1).trim().replace(/\s+/g, ' ') : match[1];

          while (jsb = (match = re.exec(expr))[1]) { skipBraces(jsb, re); }

          jsb  = expr.slice(0, match.index);
          expr = RegExp.rightContext;

          list[cnt++] = _wrapExpr(jsb, 1, key);
        }

        expr = !cnt ? _wrapExpr(expr, asText)
             : cnt > 1 ? '[' + list.join(',') + '].join(" ").trim()' : list[0];
      }
      return expr

      function skipBraces (ch, re) {
        var
          mm,
          lv = 1,
          ir = RE_BREND[ch];

        ir.lastIndex = re.lastIndex;
        while (mm = ir.exec(expr)) {
          if (mm[0] === ch) { ++lv; }
          else if (!--lv) { break }
        }
        re.lastIndex = lv ? expr.length : ir.lastIndex;
      }
    }

    // istanbul ignore next: not both
    var // eslint-disable-next-line max-len
      JS_CONTEXT = '"in this?this:' + (typeof window !== 'object' ? 'global' : 'window') + ').',
      JS_VARNAME = /[,{][\$\w]+(?=:)|(^ *|[^$\w\.{])(?!(?:typeof|true|false|null|undefined|in|instanceof|is(?:Finite|NaN)|void|NaN|new|Date|RegExp|Math)(?![$\w]))([$_A-Za-z][$\w]*)/g,
      JS_NOPROPS = /^(?=(\.[$\w]+))\1(?:[^.[(]|$)/;

    function _wrapExpr (expr, asText, key) {
      var tb;

      expr = expr.replace(JS_VARNAME, function (match, p, mvar, pos, s) {
        if (mvar) {
          pos = tb ? 0 : pos + match.length;

          if (mvar !== 'this' && mvar !== 'global' && mvar !== 'window') {
            match = p + '("' + mvar + JS_CONTEXT + mvar;
            if (pos) { tb = (s = s[pos]) === '.' || s === '(' || s === '['; }
          } else if (pos) {
            tb = !JS_NOPROPS.test(s.slice(pos));
          }
        }
        return match
      });

      if (tb) {
        expr = 'try{return ' + expr + '}catch(e){E(e,this)}';
      }

      if (key) {

        expr = (tb
            ? 'function(){' + expr + '}.call(this)' : '(' + expr + ')'
          ) + '?"' + key + '":""';

      } else if (asText) {

        expr = 'function(v){' + (tb
            ? expr.replace('return ', 'v=') : 'v=(' + expr + ')'
          ) + ';return v||v===0?v:""}.call(this)';
      }

      return expr
    }

    _tmpl.version = brackets.version = 'v3.0.8';

    return _tmpl

  })();

  /* istanbul ignore next */
  var observable = function(el) {

    /**
     * Extend the original object or create a new empty one
     * @type { Object }
     */

    el = el || {};

    /**
     * Private variables
     */
    var callbacks = {},
      slice = Array.prototype.slice;

    /**
     * Public Api
     */

    // extend the el object adding the observable methods
    Object.defineProperties(el, {
      /**
       * Listen to the given `event` ands
       * execute the `callback` each time an event is triggered.
       * @param  { String } event - event id
       * @param  { Function } fn - callback function
       * @returns { Object } el
       */
      on: {
        value: function(event, fn) {
          if (typeof fn == 'function')
            { (callbacks[event] = callbacks[event] || []).push(fn); }
          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Removes the given `event` listeners
       * @param   { String } event - event id
       * @param   { Function } fn - callback function
       * @returns { Object } el
       */
      off: {
        value: function(event, fn) {
          if (event == '*' && !fn) { callbacks = {}; }
          else {
            if (fn) {
              var arr = callbacks[event];
              for (var i = 0, cb; cb = arr && arr[i]; ++i) {
                if (cb == fn) { arr.splice(i--, 1); }
              }
            } else { delete callbacks[event]; }
          }
          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Listen to the given `event` and
       * execute the `callback` at most once
       * @param   { String } event - event id
       * @param   { Function } fn - callback function
       * @returns { Object } el
       */
      one: {
        value: function(event, fn) {
          function on() {
            el.off(event, on);
            fn.apply(el, arguments);
          }
          return el.on(event, on)
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Execute all callback functions that listen to
       * the given `event`
       * @param   { String } event - event id
       * @returns { Object } el
       */
      trigger: {
        value: function(event) {
          var arguments$1 = arguments;


          // getting the arguments
          var arglen = arguments.length - 1,
            args = new Array(arglen),
            fns,
            fn,
            i;

          for (i = 0; i < arglen; i++) {
            args[i] = arguments$1[i + 1]; // skip first argument
          }

          fns = slice.call(callbacks[event] || [], 0);

          for (i = 0; fn = fns[i]; ++i) {
            fn.apply(el, args);
          }

          if (callbacks['*'] && event != '*')
            { el.trigger.apply(el, ['*', event].concat(args)); }

          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      }
    });

    return el

  };

  /**
   * Short alias for Object.getOwnPropertyDescriptor
   */
  function getPropDescriptor (o, k) {
    return Object.getOwnPropertyDescriptor(o, k)
  }

  /**
   * Check if passed argument is undefined
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isUndefined(value) {
    return typeof value === T_UNDEF
  }

  /**
   * Check whether object's property could be overridden
   * @param   { Object }  obj - source object
   * @param   { String }  key - object property
   * @returns { Boolean } true if writable
   */
  function isWritable(obj, key) {
    var descriptor = getPropDescriptor(obj, key);
    return isUndefined(obj[key]) || descriptor && descriptor.writable
  }

  /**
   * Extend any object with other properties
   * @param   { Object } src - source object
   * @returns { Object } the resulting extended object
   *
   * var obj = { foo: 'baz' }
   * extend(obj, {bar: 'bar', foo: 'bar'})
   * console.log(obj) => {bar: 'bar', foo: 'bar'}
   *
   */
  function extend(src) {
    var obj;
    var i = 1;
    var args = arguments;
    var l = args.length;

    for (; i < l; i++) {
      if (obj = args[i]) {
        for (var key in obj) {
          // check if this property of the source object could be overridden
          if (isWritable(src, key))
            { src[key] = obj[key]; }
        }
      }
    }
    return src
  }

  /**
   * Alias for Object.create
   */
  function create(src) {
    return Object.create(src)
  }

  var settings = extend(create(brackets.settings), {
    skipAnonymousTags: true,
    // the "value" attributes will be preserved
    keepValueAttributes: false,
    // handle the auto updates on any DOM event
    autoUpdate: true
  });

  /**
   * Shorter and fast way to select multiple nodes in the DOM
   * @param   { String } selector - DOM selector
   * @param   { Object } ctx - DOM node where the targets of our search will is located
   * @returns { Object } dom nodes found
   */
  function $$(selector, ctx) {
    return [].slice.call((ctx || document).querySelectorAll(selector))
  }

  /**
   * Create a document text node
   * @returns { Object } create a text node to use as placeholder
   */
  function createDOMPlaceholder() {
    return document.createTextNode('')
  }

  /**
   * Toggle the visibility of any DOM node
   * @param   { Object }  dom - DOM node we want to hide
   * @param   { Boolean } show - do we want to show it?
   */

  function toggleVisibility(dom, show) {
    dom.style.display = show ? '' : 'none';
    dom.hidden = show ? false : true;
  }

  /**
   * Get the value of any DOM attribute on a node
   * @param   { Object } dom - DOM node we want to parse
   * @param   { String } name - name of the attribute we want to get
   * @returns { String | undefined } name of the node attribute whether it exists
   */
  function getAttribute(dom, name) {
    return dom.getAttribute(name)
  }

  /**
   * Remove any DOM attribute from a node
   * @param   { Object } dom - DOM node we want to update
   * @param   { String } name - name of the property we want to remove
   */
  function removeAttribute(dom, name) {
    dom.removeAttribute(name);
  }

  /**
   * Set the inner html of any DOM node SVGs included
   * @param { Object } container - DOM node where we'll inject new html
   * @param { String } html - html to inject
   * @param { Boolean } isSvg - svg tags should be treated a bit differently
   */
  /* istanbul ignore next */
  function setInnerHTML(container, html, isSvg) {
    // innerHTML is not supported on svg tags so we neet to treat them differently
    if (isSvg) {
      var node = container.ownerDocument.importNode(
        new DOMParser()
          .parseFromString(("<svg xmlns=\"" + SVG_NS + "\">" + html + "</svg>"), 'application/xml')
          .documentElement,
        true
      );

      container.appendChild(node);
    } else {
      container.innerHTML = html;
    }
  }

  /**
   * Minimize risk: only zero or one _space_ between attr & value
   * @param   { String }   html - html string we want to parse
   * @param   { Function } fn - callback function to apply on any attribute found
   */
  function walkAttributes(html, fn) {
    if (!html) { return }
    var m;
    while (m = RE_HTML_ATTRS.exec(html))
      { fn(m[1].toLowerCase(), m[2] || m[3] || m[4]); }
  }

  /**
   * Create a document fragment
   * @returns { Object } document fragment
   */
  function createFragment() {
    return document.createDocumentFragment()
  }

  /**
   * Insert safely a tag to fix #1962 #1649
   * @param   { HTMLElement } root - children container
   * @param   { HTMLElement } curr - node to insert
   * @param   { HTMLElement } next - node that should preceed the current node inserted
   */
  function safeInsert(root, curr, next) {
    root.insertBefore(curr, next.parentNode && next);
  }

  /**
   * Convert a style object to a string
   * @param   { Object } style - style object we need to parse
   * @returns { String } resulting css string
   * @example
   * styleObjectToString({ color: 'red', height: '10px'}) // => 'color: red; height: 10px'
   */
  function styleObjectToString(style) {
    return Object.keys(style).reduce(function (acc, prop) {
      return (acc + " " + prop + ": " + (style[prop]) + ";")
    }, '')
  }

  /**
   * Walk down recursively all the children tags starting dom node
   * @param   { Object }   dom - starting node where we will start the recursion
   * @param   { Function } fn - callback to transform the child node just found
   * @param   { Object }   context - fn can optionally return an object, which is passed to children
   */
  function walkNodes(dom, fn, context) {
    if (dom) {
      var res = fn(dom, context);
      var next;
      // stop the recursion
      if (res === false) { return }

      dom = dom.firstChild;

      while (dom) {
        next = dom.nextSibling;
        walkNodes(dom, fn, res);
        dom = next;
      }
    }
  }



  var dom = /*#__PURE__*/Object.freeze({
    $$: $$,
    $: $,
    createDOMPlaceholder: createDOMPlaceholder,
    mkEl: makeElement,
    setAttr: setAttribute,
    toggleVisibility: toggleVisibility,
    getAttr: getAttribute,
    remAttr: removeAttribute,
    setInnerHTML: setInnerHTML,
    walkAttrs: walkAttributes,
    createFrag: createFragment,
    safeInsert: safeInsert,
    styleObjectToString: styleObjectToString,
    walkNodes: walkNodes
  });

  /**
   * Check against the null and undefined values
   * @param   { * }  value -
   * @returns {Boolean} -
   */
  function isNil(value) {
    return isUndefined(value) || value === null
  }

  /**
   * Check if passed argument is empty. Different from falsy, because we dont consider 0 or false to be blank
   * @param { * } value -
   * @returns { Boolean } -
   */
  function isBlank(value) {
    return isNil(value) || value === ''
  }

  /**
   * Check if passed argument is a function
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isFunction(value) {
    return typeof value === T_FUNCTION
  }

  /**
   * Check if passed argument is an object, exclude null
   * NOTE: use isObject(x) && !isArray(x) to excludes arrays.
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isObject(value) {
    return value && typeof value === T_OBJECT // typeof null is 'object'
  }

  /**
   * Check if a DOM node is an svg tag or part of an svg
   * @param   { HTMLElement }  el - node we want to test
   * @returns {Boolean} true if it's an svg node
   */
  function isSvg(el) {
    var owner = el.ownerSVGElement;
    return !!owner || owner === null
  }

  /**
   * Check if passed argument is a kind of array
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isArray(value) {
    return Array.isArray(value) || value instanceof Array
  }

  /**
   * Check if the passed argument is a boolean attribute
   * @param   { String } value -
   * @returns { Boolean } -
   */
  function isBoolAttr(value) {
    return RE_BOOL_ATTRS.test(value)
  }

  /**
   * Check if passed argument is a string
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isString(value) {
    return typeof value === T_STRING
  }



  var check = /*#__PURE__*/Object.freeze({
    isBlank: isBlank,
    isFunction: isFunction,
    isObject: isObject,
    isSvg: isSvg,
    isWritable: isWritable,
    isArray: isArray,
    isBoolAttr: isBoolAttr,
    isNil: isNil,
    isString: isString,
    isUndefined: isUndefined
  });

  /**
   * Check whether an array contains an item
   * @param   { Array } array - target array
   * @param   { * } item - item to test
   * @returns { Boolean } -
   */
  function contains(array, item) {
    return array.indexOf(item) !== -1
  }

  /**
   * Specialized function for looping an array-like collection with `each={}`
   * @param   { Array } list - collection of items
   * @param   {Function} fn - callback function
   * @returns { Array } the array looped
   */
  function each(list, fn) {
    var len = list ? list.length : 0;
    var i = 0;
    for (; i < len; i++) { fn(list[i], i); }
    return list
  }

  /**
   * Faster String startsWith alternative
   * @param   { String } str - source string
   * @param   { String } value - test string
   * @returns { Boolean } -
   */
  function startsWith(str, value) {
    return str.slice(0, value.length) === value
  }

  /**
   * Function returning always a unique identifier
   * @returns { Number } - number from 0...n
   */
  var uid = (function uid() {
    var i = -1;
    return function () { return ++i; }
  })();

  /**
   * Helper function to set an immutable property
   * @param   { Object } el - object where the new property will be set
   * @param   { String } key - object key where the new property will be stored
   * @param   { * } value - value of the new property
   * @param   { Object } options - set the propery overriding the default options
   * @returns { Object } - the initial object
   */
  function define(el, key, value, options) {
    Object.defineProperty(el, key, extend({
      value: value,
      enumerable: false,
      writable: false,
      configurable: true
    }, options));
    return el
  }

  /**
   * Convert a string containing dashes to camel case
   * @param   { String } str - input string
   * @returns { String } my-string -> myString
   */
  function toCamel(str) {
    return str.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })
  }

  /**
   * Warn a message via console
   * @param   {String} message - warning message
   */
  function warn(message) {
    if (console && console.warn) { console.warn(message); }
  }



  var misc = /*#__PURE__*/Object.freeze({
    contains: contains,
    each: each,
    getPropDescriptor: getPropDescriptor,
    startsWith: startsWith,
    uid: uid,
    defineProperty: define,
    objectCreate: create,
    extend: extend,
    toCamel: toCamel,
    warn: warn
  });

  /**
   * Set the property of an object for a given key. If something already
   * exists there, then it becomes an array containing both the old and new value.
   * @param { Object } obj - object on which to set the property
   * @param { String } key - property name
   * @param { Object } value - the value of the property to be set
   * @param { Boolean } ensureArray - ensure that the property remains an array
   * @param { Number } index - add the new item in a certain array position
   */
  function arrayishAdd(obj, key, value, ensureArray, index) {
    var dest = obj[key];
    var isArr = isArray(dest);
    var hasIndex = !isUndefined(index);

    if (dest && dest === value) { return }

    // if the key was never set, set it once
    if (!dest && ensureArray) { obj[key] = [value]; }
    else if (!dest) { obj[key] = value; }
    // if it was an array and not yet set
    else {
      if (isArr) {
        var oldIndex = dest.indexOf(value);
        // this item never changed its position
        if (oldIndex === index) { return }
        // remove the item from its old position
        if (oldIndex !== -1) { dest.splice(oldIndex, 1); }
        // move or add the item
        if (hasIndex) {
          dest.splice(index, 0, value);
        } else {
          dest.push(value);
        }
      } else { obj[key] = [dest, value]; }
    }
  }

  /**
   * Detect the tag implementation by a DOM node
   * @param   { Object } dom - DOM node we need to parse to get its tag implementation
   * @returns { Object } it returns an object containing the implementation of a custom tag (template and boot function)
   */
  function get(dom) {
    return dom.tagName && __TAG_IMPL[getAttribute(dom, IS_DIRECTIVE) ||
      getAttribute(dom, IS_DIRECTIVE) || dom.tagName.toLowerCase()]
  }

  /**
   * Get the tag name of any DOM node
   * @param   { Object } dom - DOM node we want to parse
   * @param   { Boolean } skipDataIs - hack to ignore the data-is attribute when attaching to parent
   * @returns { String } name to identify this dom node in riot
   */
  function getName(dom, skipDataIs) {
    var child = get(dom);
    var namedTag = !skipDataIs && getAttribute(dom, IS_DIRECTIVE);
    return namedTag && !tmpl.hasExpr(namedTag) ?
      namedTag : child ? child.name : dom.tagName.toLowerCase()
  }

  /**
   * Return a temporary context containing also the parent properties
   * @this Tag
   * @param { Tag } - temporary tag context containing all the parent properties
   */
  function inheritParentProps() {
    if (this.parent) { return extend(create(this), this.parent) }
    return this
  }

  /*
    Includes hacks needed for the Internet Explorer version 9 and below
    See: http://kangax.github.io/compat-table/es5/#ie8
         http://codeplanet.io/dropping-ie8/
  */

  var
    reHasYield  = /<yield\b/i,
    reYieldAll  = /<yield\s*(?:\/>|>([\S\s]*?)<\/yield\s*>|>)/ig,
    reYieldSrc  = /<yield\s+to=['"]([^'">]*)['"]\s*>([\S\s]*?)<\/yield\s*>/ig,
    reYieldDest = /<yield\s+from=['"]?([-\w]+)['"]?\s*(?:\/>|>([\S\s]*?)<\/yield\s*>)/ig,
    rootEls = { tr: 'tbody', th: 'tr', td: 'tr', col: 'colgroup' },
    tblTags = IE_VERSION && IE_VERSION < 10 ? RE_SPECIAL_TAGS : RE_SPECIAL_TAGS_NO_OPTION,
    GENERIC = 'div',
    SVG = 'svg';


  /*
    Creates the root element for table or select child elements:
    tr/th/td/thead/tfoot/tbody/caption/col/colgroup/option/optgroup
  */
  function specialTags(el, tmpl, tagName) {

    var
      select = tagName[0] === 'o',
      parent = select ? 'select>' : 'table>';

    // trim() is important here, this ensures we don't have artifacts,
    // so we can check if we have only one element inside the parent
    el.innerHTML = '<' + parent + tmpl.trim() + '</' + parent;
    parent = el.firstChild;

    // returns the immediate parent if tr/th/td/col is the only element, if not
    // returns the whole tree, as this can include additional elements
    /* istanbul ignore next */
    if (select) {
      parent.selectedIndex = -1;  // for IE9, compatible w/current riot behavior
    } else {
      // avoids insertion of cointainer inside container (ex: tbody inside tbody)
      var tname = rootEls[tagName];
      if (tname && parent.childElementCount === 1) { parent = $(tname, parent); }
    }
    return parent
  }

  /*
    Replace the yield tag from any tag template with the innerHTML of the
    original tag in the page
  */
  function replaceYield(tmpl, html) {
    // do nothing if no yield
    if (!reHasYield.test(tmpl)) { return tmpl }

    // be careful with #1343 - string on the source having `$1`
    var src = {};

    html = html && html.replace(reYieldSrc, function (_, ref, text) {
      src[ref] = src[ref] || text;   // preserve first definition
      return ''
    }).trim();

    return tmpl
      .replace(reYieldDest, function (_, ref, def) {  // yield with from - to attrs
        return src[ref] || def || ''
      })
      .replace(reYieldAll, function (_, def) {        // yield without any "from"
        return html || def || ''
      })
  }

  /**
   * Creates a DOM element to wrap the given content. Normally an `DIV`, but can be
   * also a `TABLE`, `SELECT`, `TBODY`, `TR`, or `COLGROUP` element.
   *
   * @param   { String } tmpl  - The template coming from the custom tag definition
   * @param   { String } html - HTML content that comes from the DOM element where you
   *           will mount the tag, mostly the original tag in the page
   * @param   { Boolean } isSvg - true if the root node is an svg
   * @returns { HTMLElement } DOM element with _tmpl_ merged through `YIELD` with the _html_.
   */
  function mkdom(tmpl, html, isSvg) {
    var match   = tmpl && tmpl.match(/^\s*<([-\w]+)/);
    var  tagName = match && match[1].toLowerCase();
    var el = makeElement(isSvg ? SVG : GENERIC);

    // replace all the yield tags with the tag inner html
    tmpl = replaceYield(tmpl, html);

    /* istanbul ignore next */
    if (tblTags.test(tagName))
      { el = specialTags(el, tmpl, tagName); }
    else
      { setInnerHTML(el, tmpl, isSvg); }

    return el
  }

  var EVENT_ATTR_RE = /^on/;

  /**
   * True if the event attribute starts with 'on'
   * @param   { String } attribute - event attribute
   * @returns { Boolean }
   */
  function isEventAttribute(attribute) {
    return EVENT_ATTR_RE.test(attribute)
  }

  /**
   * Loop backward all the parents tree to detect the first custom parent tag
   * @param   { Object } tag - a Tag instance
   * @returns { Object } the instance of the first custom parent tag found
   */
  function getImmediateCustomParent(tag) {
    var ptag = tag;
    while (ptag.__.isAnonymous) {
      if (!ptag.parent) { break }
      ptag = ptag.parent;
    }
    return ptag
  }

  /**
   * Trigger DOM events
   * @param   { HTMLElement } dom - dom element target of the event
   * @param   { Function } handler - user function
   * @param   { Object } e - event object
   */
  function handleEvent(dom, handler, e) {
    var ptag = this.__.parent;
    var item = this.__.item;

    if (!item)
      { while (ptag && !item) {
        item = ptag.__.item;
        ptag = ptag.__.parent;
      } }

    // override the event properties
    /* istanbul ignore next */
    if (isWritable(e, 'currentTarget')) { e.currentTarget = dom; }
    /* istanbul ignore next */
    if (isWritable(e, 'target')) { e.target = e.srcElement; }
    /* istanbul ignore next */
    if (isWritable(e, 'which')) { e.which = e.charCode || e.keyCode; }

    e.item = item;

    handler.call(this, e);

    // avoid auto updates
    if (!settings.autoUpdate) { return }

    if (!e.preventUpdate) {
      var p = getImmediateCustomParent(this);
      // fixes #2083
      if (p.isMounted) { p.update(); }
    }
  }

  /**
   * Attach an event to a DOM node
   * @param { String } name - event name
   * @param { Function } handler - event callback
   * @param { Object } dom - dom node
   * @param { Tag } tag - tag instance
   */
  function setEventHandler(name, handler, dom, tag) {
    var eventName;
    var cb = handleEvent.bind(tag, dom, handler);

    // avoid to bind twice the same event
    // possible fix for #2332
    dom[name] = null;

    // normalize event name
    eventName = name.replace(RE_EVENTS_PREFIX, '');

    // cache the listener into the listeners array
    if (!contains(tag.__.listeners, dom)) { tag.__.listeners.push(dom); }
    if (!dom[RIOT_EVENTS_KEY]) { dom[RIOT_EVENTS_KEY] = {}; }
    if (dom[RIOT_EVENTS_KEY][name]) { dom.removeEventListener(eventName, dom[RIOT_EVENTS_KEY][name]); }

    dom[RIOT_EVENTS_KEY][name] = cb;
    dom.addEventListener(eventName, cb, false);
  }

  /**
   * Create a new child tag including it correctly into its parent
   * @param   { Object } child - child tag implementation
   * @param   { Object } opts - tag options containing the DOM node where the tag will be mounted
   * @param   { String } innerHTML - inner html of the child node
   * @param   { Object } parent - instance of the parent tag including the child custom tag
   * @returns { Object } instance of the new child tag just created
   */
  function initChild(child, opts, innerHTML, parent) {
    var tag = createTag(child, opts, innerHTML);
    var tagName = opts.tagName || getName(opts.root, true);
    var ptag = getImmediateCustomParent(parent);
    // fix for the parent attribute in the looped elements
    define(tag, 'parent', ptag);
    // store the real parent tag
    // in some cases this could be different from the custom parent tag
    // for example in nested loops
    tag.__.parent = parent;

    // add this tag to the custom parent tag
    arrayishAdd(ptag.tags, tagName, tag);

    // and also to the real parent tag
    if (ptag !== parent)
      { arrayishAdd(parent.tags, tagName, tag); }

    return tag
  }

  /**
   * Removes an item from an object at a given key. If the key points to an array,
   * then the item is just removed from the array.
   * @param { Object } obj - object on which to remove the property
   * @param { String } key - property name
   * @param { Object } value - the value of the property to be removed
   * @param { Boolean } ensureArray - ensure that the property remains an array
  */
  function arrayishRemove(obj, key, value, ensureArray) {
    if (isArray(obj[key])) {
      var index = obj[key].indexOf(value);
      if (index !== -1) { obj[key].splice(index, 1); }
      if (!obj[key].length) { delete obj[key]; }
      else if (obj[key].length === 1 && !ensureArray) { obj[key] = obj[key][0]; }
    } else if (obj[key] === value)
      { delete obj[key]; } // otherwise just delete the key
  }

  /**
   * Adds the elements for a virtual tag
   * @this Tag
   * @param { Node } src - the node that will do the inserting or appending
   * @param { Tag } target - only if inserting, insert before this tag's first child
   */
  function makeVirtual(src, target) {
    var this$1 = this;

    var head = createDOMPlaceholder();
    var tail = createDOMPlaceholder();
    var frag = createFragment();
    var sib;
    var el;

    this.root.insertBefore(head, this.root.firstChild);
    this.root.appendChild(tail);

    this.__.head = el = head;
    this.__.tail = tail;

    while (el) {
      sib = el.nextSibling;
      frag.appendChild(el);
      this$1.__.virts.push(el); // hold for unmounting
      el = sib;
    }

    if (target)
      { src.insertBefore(frag, target.__.head); }
    else
      { src.appendChild(frag); }
  }

  /**
   * makes a tag virtual and replaces a reference in the dom
   * @this Tag
   * @param { tag } the tag to make virtual
   * @param { ref } the dom reference location
   */
  function makeReplaceVirtual(tag, ref) {
    if (!ref.parentNode) { return }
    var frag = createFragment();
    makeVirtual.call(tag, frag);
    ref.parentNode.replaceChild(frag, ref);
  }

  /**
   * Update dynamically created data-is tags with changing expressions
   * @param { Object } expr - expression tag and expression info
   * @param { Tag }    parent - parent for tag creation
   * @param { String } tagName - tag implementation we want to use
   */
  function updateDataIs(expr, parent, tagName) {
    var tag = expr.tag || expr.dom._tag;
    var ref;

    var ref$1 = tag ? tag.__ : {};
    var head = ref$1.head;
    var isVirtual = expr.dom.tagName === 'VIRTUAL';

    if (tag && expr.tagName === tagName) {
      tag.update();
      return
    }

    // sync _parent to accommodate changing tagnames
    if (tag) {
      // need placeholder before unmount
      if(isVirtual) {
        ref = createDOMPlaceholder();
        head.parentNode.insertBefore(ref, head);
      }

      tag.unmount(true);
    }

    // unable to get the tag name
    if (!isString(tagName)) { return }

    expr.impl = __TAG_IMPL[tagName];

    // unknown implementation
    if (!expr.impl) { return }

    expr.tag = tag = initChild(
      expr.impl, {
        root: expr.dom,
        parent: parent,
        tagName: tagName
      },
      expr.dom.innerHTML,
      parent
    );

    each(expr.attrs, function (a) { return setAttribute(tag.root, a.name, a.value); });
    expr.tagName = tagName;
    tag.mount();

    // root exist first time, after use placeholder
    if (isVirtual) { makeReplaceVirtual(tag, ref || tag.root); }

    // parent is the placeholder tag, not the dynamic tag so clean up
    parent.__.onUnmount = function () {
      var delName = tag.opts.dataIs;
      arrayishRemove(tag.parent.tags, delName, tag);
      arrayishRemove(tag.__.parent.tags, delName, tag);
      tag.unmount();
    };
  }

  /**
   * Nomalize any attribute removing the "riot-" prefix
   * @param   { String } attrName - original attribute name
   * @returns { String } valid html attribute name
   */
  function normalizeAttrName(attrName) {
    if (!attrName) { return null }
    attrName = attrName.replace(ATTRS_PREFIX, '');
    if (CASE_SENSITIVE_ATTRIBUTES[attrName]) { attrName = CASE_SENSITIVE_ATTRIBUTES[attrName]; }
    return attrName
  }

  /**
   * Update on single tag expression
   * @this Tag
   * @param { Object } expr - expression logic
   * @returns { undefined }
   */
  function updateExpression(expr) {
    if (this.root && getAttribute(this.root,'virtualized')) { return }

    var dom = expr.dom;
    // remove the riot- prefix
    var attrName = normalizeAttrName(expr.attr);
    var isToggle = contains([SHOW_DIRECTIVE, HIDE_DIRECTIVE], attrName);
    var isVirtual = expr.root && expr.root.tagName === 'VIRTUAL';
    var ref = this.__;
    var isAnonymous = ref.isAnonymous;
    var parent = dom && (expr.parent || dom.parentNode);
    var keepValueAttributes = settings.keepValueAttributes;
    // detect the style attributes
    var isStyleAttr = attrName === 'style';
    var isClassAttr = attrName === 'class';
    var isValueAttr = attrName === 'value';

    var value;

    // if it's a tag we could totally skip the rest
    if (expr._riot_id) {
      if (expr.__.wasCreated) {
        expr.update();
      // if it hasn't been mounted yet, do that now.
      } else {
        expr.mount();
        if (isVirtual) {
          makeReplaceVirtual(expr, expr.root);
        }
      }
      return
    }

    // if this expression has the update method it means it can handle the DOM changes by itself
    if (expr.update) { return expr.update() }

    var context = isToggle && !isAnonymous ? inheritParentProps.call(this) : this;

    // ...it seems to be a simple expression so we try to calculate its value
    value = tmpl(expr.expr, context);

    var hasValue = !isBlank(value);
    var isObj = isObject(value);

    // convert the style/class objects to strings
    if (isObj) {
      if (isClassAttr) {
        value = tmpl(JSON.stringify(value), this);
      } else if (isStyleAttr) {
        value = styleObjectToString(value);
      }
    }

    // remove original attribute
    if (expr.attr &&
        (
          // the original attribute can be removed only if we are parsing the original expression
          !expr.wasParsedOnce ||
          // or its value is false
          value === false ||
          // or if its value is currently falsy...
          // We will keep the "value" attributes if the "keepValueAttributes"
          // is enabled though
          (!hasValue && (!isValueAttr || isValueAttr && !keepValueAttributes))
        )
    ) {
      // remove either riot-* attributes or just the attribute name
      removeAttribute(dom, getAttribute(dom, expr.attr) ? expr.attr : attrName);
    }

    // for the boolean attributes we don't need the value
    // we can convert it to checked=true to checked=checked
    if (expr.bool) { value = value ? attrName : false; }
    if (expr.isRtag) { return updateDataIs(expr, this, value) }
    if (expr.wasParsedOnce && expr.value === value) { return }

    // update the expression value
    expr.value = value;
    expr.wasParsedOnce = true;

    // if the value is an object (and it's not a style or class attribute) we can not do much more with it
    if (isObj && !isClassAttr && !isStyleAttr && !isToggle) { return }
    // avoid to render undefined/null values
    if (!hasValue) { value = ''; }

    // textarea and text nodes have no attribute name
    if (!attrName) {
      // about #815 w/o replace: the browser converts the value to a string,
      // the comparison by "==" does too, but not in the server
      value += '';
      // test for parent avoids error with invalid assignment to nodeValue
      if (parent) {
        // cache the parent node because somehow it will become null on IE
        // on the next iteration
        expr.parent = parent;
        if (parent.tagName === 'TEXTAREA') {
          parent.value = value;                    // #1113
          if (!IE_VERSION) { dom.nodeValue = value; }  // #1625 IE throws here, nodeValue
        }                                         // will be available on 'updated'
        else { dom.nodeValue = value; }
      }
      return
    }

    switch (true) {
    // handle events binding
    case isFunction(value):
      if (isEventAttribute(attrName)) {
        setEventHandler(attrName, value, dom, this);
      }
      break
    // show / hide
    case isToggle:
      toggleVisibility(dom, attrName === HIDE_DIRECTIVE ? !value : value);
      break
    // handle attributes
    default:
      if (expr.bool) {
        dom[attrName] = value;
      }

      if (isValueAttr && dom.value !== value) {
        dom.value = value;
      } else if (hasValue && value !== false) {
        setAttribute(dom, attrName, value);
      }

      // make sure that in case of style changes
      // the element stays hidden
      if (isStyleAttr && dom.hidden) { toggleVisibility(dom, false); }
    }
  }

  /**
   * Update all the expressions in a Tag instance
   * @this Tag
   * @param { Array } expressions - expression that must be re evaluated
   */
  function update(expressions) {
    each(expressions, updateExpression.bind(this));
  }

  /**
   * We need to update opts for this tag. That requires updating the expressions
   * in any attributes on the tag, and then copying the result onto opts.
   * @this Tag
   * @param   {Boolean} isLoop - is it a loop tag?
   * @param   { Tag }  parent - parent tag node
   * @param   { Boolean }  isAnonymous - is it a tag without any impl? (a tag not registered)
   * @param   { Object }  opts - tag options
   * @param   { Array }  instAttrs - tag attributes array
   */
  function updateOpts(isLoop, parent, isAnonymous, opts, instAttrs) {
    // isAnonymous `each` tags treat `dom` and `root` differently. In this case
    // (and only this case) we don't need to do updateOpts, because the regular parse
    // will update those attrs. Plus, isAnonymous tags don't need opts anyway
    if (isLoop && isAnonymous) { return }
    var ctx = isLoop ? inheritParentProps.call(this) : parent || this;

    each(instAttrs, function (attr) {
      if (attr.expr) { updateExpression.call(ctx, attr.expr); }
      // normalize the attribute names
      opts[toCamel(attr.name).replace(ATTRS_PREFIX, '')] = attr.expr ? attr.expr.value : attr.value;
    });
  }

  /**
   * Update the tag expressions and options
   * @param { Tag } tag - tag object
   * @param { * } data - data we want to use to extend the tag properties
   * @param { Array } expressions - component expressions array
   * @returns { Tag } the current tag instance
   */
  function componentUpdate(tag, data, expressions) {
    var __ = tag.__;
    var nextOpts = {};
    var canTrigger = tag.isMounted && !__.skipAnonymous;

    // inherit properties from the parent tag
    if (__.isAnonymous && __.parent) { extend(tag, __.parent); }
    extend(tag, data);

    updateOpts.apply(tag, [__.isLoop, __.parent, __.isAnonymous, nextOpts, __.instAttrs]);

    if (
      canTrigger &&
      tag.isMounted &&
      isFunction(tag.shouldUpdate) && !tag.shouldUpdate(data, nextOpts)
    ) {
      return tag
    }

    extend(tag.opts, nextOpts);

    if (canTrigger) { tag.trigger('update', data); }
    update.call(tag, expressions);
    if (canTrigger) { tag.trigger('updated'); }

    return tag
  }

  /**
   * Get selectors for tags
   * @param   { Array } tags - tag names to select
   * @returns { String } selector
   */
  function query(tags) {
    // select all tags
    if (!tags) {
      var keys = Object.keys(__TAG_IMPL);
      return keys + query(keys)
    }

    return tags
      .filter(function (t) { return !/[^-\w]/.test(t); })
      .reduce(function (list, t) {
        var name = t.trim().toLowerCase();
        return list + ",[" + IS_DIRECTIVE + "=\"" + name + "\"]"
      }, '')
  }

  /**
   * Another way to create a riot tag a bit more es6 friendly
   * @param { HTMLElement } el - tag DOM selector or DOM node/s
   * @param { Object } opts - tag logic
   * @returns { Tag } new riot tag instance
   */
  function Tag(el, opts) {
    // get the tag properties from the class constructor
    var ref = this;
    var name = ref.name;
    var tmpl = ref.tmpl;
    var css = ref.css;
    var attrs = ref.attrs;
    var onCreate = ref.onCreate;
    // register a new tag and cache the class prototype
    if (!__TAG_IMPL[name]) {
      tag(name, tmpl, css, attrs, onCreate);
      // cache the class constructor
      __TAG_IMPL[name].class = this.constructor;
    }

    // mount the tag using the class instance
    mount$1(el, name, opts, this);
    // inject the component css
    if (css) { styleManager.inject(); }

    return this
  }

  /**
   * Create a new riot tag implementation
   * @param   { String }   name - name/id of the new riot tag
   * @param   { String }   tmpl - tag template
   * @param   { String }   css - custom tag css
   * @param   { String }   attrs - root tag attributes
   * @param   { Function } fn - user function
   * @returns { String } name/id of the tag just created
   */
  function tag(name, tmpl, css, attrs, fn) {
    if (isFunction(attrs)) {
      fn = attrs;

      if (/^[\w-]+\s?=/.test(css)) {
        attrs = css;
        css = '';
      } else
        { attrs = ''; }
    }

    if (css) {
      if (isFunction(css))
        { fn = css; }
      else
        { styleManager.add(css, name); }
    }

    name = name.toLowerCase();
    __TAG_IMPL[name] = { name: name, tmpl: tmpl, attrs: attrs, fn: fn };

    return name
  }

  /**
   * Create a new riot tag implementation (for use by the compiler)
   * @param   { String }   name - name/id of the new riot tag
   * @param   { String }   tmpl - tag template
   * @param   { String }   css - custom tag css
   * @param   { String }   attrs - root tag attributes
   * @param   { Function } fn - user function
   * @returns { String } name/id of the tag just created
   */
  function tag2(name, tmpl, css, attrs, fn) {
    if (css) { styleManager.add(css, name); }

    __TAG_IMPL[name] = { name: name, tmpl: tmpl, attrs: attrs, fn: fn };

    return name
  }

  /**
   * Mount a tag using a specific tag implementation
   * @param   { * } selector - tag DOM selector or DOM node/s
   * @param   { String } tagName - tag implementation name
   * @param   { Object } opts - tag logic
   * @returns { Array } new tags instances
   */
  function mount(selector, tagName, opts) {
    var tags = [];
    var elem, allTags;

    function pushTagsTo(root) {
      if (root.tagName) {
        var riotTag = getAttribute(root, IS_DIRECTIVE), tag;

        // have tagName? force riot-tag to be the same
        if (tagName && riotTag !== tagName) {
          riotTag = tagName;
          setAttribute(root, IS_DIRECTIVE, tagName);
        }

        tag = mount$1(
          root,
          riotTag || root.tagName.toLowerCase(),
          isFunction(opts) ? opts() : opts
        );

        if (tag)
          { tags.push(tag); }
      } else if (root.length)
        { each(root, pushTagsTo); } // assume nodeList
    }

    // inject styles into DOM
    styleManager.inject();

    if (isObject(tagName) || isFunction(tagName)) {
      opts = tagName;
      tagName = 0;
    }

    // crawl the DOM to find the tag
    if (isString(selector)) {
      selector = selector === '*' ?
        // select all registered tags
        // & tags found with the riot-tag attribute set
        allTags = query() :
        // or just the ones named like the selector
        selector + query(selector.split(/, */));

      // make sure to pass always a selector
      // to the querySelectorAll function
      elem = selector ? $$(selector) : [];
    }
    else
      // probably you have passed already a tag or a NodeList
      { elem = selector; }

    // select all the registered and mount them inside their root elements
    if (tagName === '*') {
      // get all custom tags
      tagName = allTags || query();
      // if the root els it's just a single tag
      if (elem.tagName)
        { elem = $$(tagName, elem); }
      else {
        // select all the children for all the different root elements
        var nodeList = [];

        each(elem, function (_el) { return nodeList.push($$(tagName, _el)); });

        elem = nodeList;
      }
      // get rid of the tagName
      tagName = 0;
    }

    pushTagsTo(elem);

    return tags
  }

  // Create a mixin that could be globally shared across all the tags
  var mixins = {};
  var globals = mixins[GLOBAL_MIXIN] = {};
  var mixins_id = 0;

  /**
   * Create/Return a mixin by its name
   * @param   { String }  name - mixin name (global mixin if object)
   * @param   { Object }  mix - mixin logic
   * @param   { Boolean } g - is global?
   * @returns { Object }  the mixin logic
   */
  function mixin(name, mix, g) {
    // Unnamed global
    if (isObject(name)) {
      mixin(("__" + (mixins_id++) + "__"), name, true);
      return
    }

    var store = g ? globals : mixins;

    // Getter
    if (!mix) {
      if (isUndefined(store[name]))
        { throw new Error(("Unregistered mixin: " + name)) }

      return store[name]
    }

    // Setter
    store[name] = isFunction(mix) ?
      extend(mix.prototype, store[name] || {}) && mix :
      extend(store[name] || {}, mix);
  }

  /**
   * Update all the tags instances created
   * @returns { Array } all the tags instances
   */
  function update$1() {
    return each(__TAGS_CACHE, function (tag) { return tag.update(); })
  }

  function unregister(name) {
    styleManager.remove(name);
    return delete __TAG_IMPL[name]
  }

  var version = 'v3.13.2';

  var core = /*#__PURE__*/Object.freeze({
    Tag: Tag,
    tag: tag,
    tag2: tag2,
    mount: mount,
    mixin: mixin,
    update: update$1,
    unregister: unregister,
    version: version
  });

  /**
   * Add a mixin to this tag
   * @returns { Tag } the current tag instance
   */
  function componentMixin(tag$$1) {
    var mixins = [], len = arguments.length - 1;
    while ( len-- > 0 ) mixins[ len ] = arguments[ len + 1 ];

    each(mixins, function (mix) {
      var instance;
      var obj;
      var props = [];

      // properties blacklisted and will not be bound to the tag instance
      var propsBlacklist = ['init', '__proto__'];

      mix = isString(mix) ? mixin(mix) : mix;

      // check if the mixin is a function
      if (isFunction(mix)) {
        // create the new mixin instance
        instance = new mix();
      } else { instance = mix; }

      var proto = Object.getPrototypeOf(instance);

      // build multilevel prototype inheritance chain property list
      do { props = props.concat(Object.getOwnPropertyNames(obj || instance)); }
      while (obj = Object.getPrototypeOf(obj || instance))

      // loop the keys in the function prototype or the all object keys
      each(props, function (key) {
        // bind methods to tag
        // allow mixins to override other properties/parent mixins
        if (!contains(propsBlacklist, key)) {
          // check for getters/setters
          var descriptor = getPropDescriptor(instance, key) || getPropDescriptor(proto, key);
          var hasGetterSetter = descriptor && (descriptor.get || descriptor.set);

          // apply method only if it does not already exist on the instance
          if (!tag$$1.hasOwnProperty(key) && hasGetterSetter) {
            Object.defineProperty(tag$$1, key, descriptor);
          } else {
            tag$$1[key] = isFunction(instance[key]) ?
              instance[key].bind(tag$$1) :
              instance[key];
          }
        }
      });

      // init method will be called automatically
      if (instance.init)
        { instance.init.bind(tag$$1)(tag$$1.opts); }
    });

    return tag$$1
  }

  /**
   * Move the position of a custom tag in its parent tag
   * @this Tag
   * @param   { String } tagName - key where the tag was stored
   * @param   { Number } newPos - index where the new tag will be stored
   */
  function moveChild(tagName, newPos) {
    var parent = this.parent;
    var tags;
    // no parent no move
    if (!parent) { return }

    tags = parent.tags[tagName];

    if (isArray(tags))
      { tags.splice(newPos, 0, tags.splice(tags.indexOf(this), 1)[0]); }
    else { arrayishAdd(parent.tags, tagName, this); }
  }

  /**
   * Move virtual tag and all child nodes
   * @this Tag
   * @param { Node } src  - the node that will do the inserting
   * @param { Tag } target - insert before this tag's first child
   */
  function moveVirtual(src, target) {
    var this$1 = this;

    var el = this.__.head;
    var sib;
    var frag = createFragment();

    while (el) {
      sib = el.nextSibling;
      frag.appendChild(el);
      el = sib;
      if (el === this$1.__.tail) {
        frag.appendChild(el);
        src.insertBefore(frag, target.__.head);
        break
      }
    }
  }

  /**
   * Convert the item looped into an object used to extend the child tag properties
   * @param   { Object } expr - object containing the keys used to extend the children tags
   * @param   { * } key - value to assign to the new object returned
   * @param   { * } val - value containing the position of the item in the array
   * @returns { Object } - new object containing the values of the original item
   *
   * The variables 'key' and 'val' are arbitrary.
   * They depend on the collection type looped (Array, Object)
   * and on the expression used on the each tag
   *
   */
  function mkitem(expr, key, val) {
    var item = {};
    item[expr.key] = key;
    if (expr.pos) { item[expr.pos] = val; }
    return item
  }

  /**
   * Unmount the redundant tags
   * @param   { Array } items - array containing the current items to loop
   * @param   { Array } tags - array containing all the children tags
   */
  function unmountRedundant(items, tags, filteredItemsCount) {
    var i = tags.length;
    var j = items.length - filteredItemsCount;

    while (i > j) {
      i--;
      remove.apply(tags[i], [tags, i]);
    }
  }


  /**
   * Remove a child tag
   * @this Tag
   * @param   { Array } tags - tags collection
   * @param   { Number } i - index of the tag to remove
   */
  function remove(tags, i) {
    tags.splice(i, 1);
    this.unmount();
    arrayishRemove(this.parent, this, this.__.tagName, true);
  }

  /**
   * Move the nested custom tags in non custom loop tags
   * @this Tag
   * @param   { Number } i - current position of the loop tag
   */
  function moveNestedTags(i) {
    var this$1 = this;

    each(Object.keys(this.tags), function (tagName) {
      moveChild.apply(this$1.tags[tagName], [tagName, i]);
    });
  }

  /**
   * Move a child tag
   * @this Tag
   * @param   { HTMLElement } root - dom node containing all the loop children
   * @param   { Tag } nextTag - instance of the next tag preceding the one we want to move
   * @param   { Boolean } isVirtual - is it a virtual tag?
   */
  function move(root, nextTag, isVirtual) {
    if (isVirtual)
      { moveVirtual.apply(this, [root, nextTag]); }
    else
      { safeInsert(root, this.root, nextTag.root); }
  }

  /**
   * Insert and mount a child tag
   * @this Tag
   * @param   { HTMLElement } root - dom node containing all the loop children
   * @param   { Tag } nextTag - instance of the next tag preceding the one we want to insert
   * @param   { Boolean } isVirtual - is it a virtual tag?
   */
  function insert(root, nextTag, isVirtual) {
    if (isVirtual)
      { makeVirtual.apply(this, [root, nextTag]); }
    else
      { safeInsert(root, this.root, nextTag.root); }
  }

  /**
   * Append a new tag into the DOM
   * @this Tag
   * @param   { HTMLElement } root - dom node containing all the loop children
   * @param   { Boolean } isVirtual - is it a virtual tag?
   */
  function append(root, isVirtual) {
    if (isVirtual)
      { makeVirtual.call(this, root); }
    else
      { root.appendChild(this.root); }
  }

  /**
   * Return the value we want to use to lookup the postion of our items in the collection
   * @param   { String }  keyAttr         - lookup string or expression
   * @param   { * }       originalItem    - original item from the collection
   * @param   { Object }  keyedItem       - object created by riot via { item, i in collection }
   * @param   { Boolean } hasKeyAttrExpr  - flag to check whether the key is an expression
   * @returns { * } value that we will use to figure out the item position via collection.indexOf
   */
  function getItemId(keyAttr, originalItem, keyedItem, hasKeyAttrExpr) {
    if (keyAttr) {
      return hasKeyAttrExpr ?  tmpl(keyAttr, keyedItem) :  originalItem[keyAttr]
    }

    return originalItem
  }

  /**
   * Manage tags having the 'each'
   * @param   { HTMLElement } dom - DOM node we need to loop
   * @param   { Tag } parent - parent tag instance where the dom node is contained
   * @param   { String } expr - string contained in the 'each' attribute
   * @returns { Object } expression object for this each loop
   */
  function _each(dom, parent, expr) {
    var mustReorder = typeof getAttribute(dom, LOOP_NO_REORDER_DIRECTIVE) !== T_STRING || removeAttribute(dom, LOOP_NO_REORDER_DIRECTIVE);
    var keyAttr = getAttribute(dom, KEY_DIRECTIVE);
    var hasKeyAttrExpr = keyAttr ? tmpl.hasExpr(keyAttr) : false;
    var tagName = getName(dom);
    var impl = __TAG_IMPL[tagName];
    var parentNode = dom.parentNode;
    var placeholder = createDOMPlaceholder();
    var child = get(dom);
    var ifExpr = getAttribute(dom, CONDITIONAL_DIRECTIVE);
    var tags = [];
    var isLoop = true;
    var innerHTML = dom.innerHTML;
    var isAnonymous = !__TAG_IMPL[tagName];
    var isVirtual = dom.tagName === 'VIRTUAL';
    var oldItems = [];

    // remove the each property from the original tag
    removeAttribute(dom, LOOP_DIRECTIVE);
    removeAttribute(dom, KEY_DIRECTIVE);

    // parse the each expression
    expr = tmpl.loopKeys(expr);
    expr.isLoop = true;

    if (ifExpr) { removeAttribute(dom, CONDITIONAL_DIRECTIVE); }

    // insert a marked where the loop tags will be injected
    parentNode.insertBefore(placeholder, dom);
    parentNode.removeChild(dom);

    expr.update = function updateEach() {
      // get the new items collection
      expr.value = tmpl(expr.val, parent);

      var items = expr.value;
      var frag = createFragment();
      var isObject = !isArray(items) && !isString(items);
      var root = placeholder.parentNode;
      var tmpItems = [];
      var hasKeys = isObject && !!items;

      // if this DOM was removed the update here is useless
      // this condition fixes also a weird async issue on IE in our unit test
      if (!root) { return }

      // object loop. any changes cause full redraw
      if (isObject) {
        items = items ? Object.keys(items).map(function (key) { return mkitem(expr, items[key], key); }) : [];
      }

      // store the amount of filtered items
      var filteredItemsCount = 0;

      // loop all the new items
      each(items, function (_item, index) {
        var i = index - filteredItemsCount;
        var item = !hasKeys && expr.key ? mkitem(expr, _item, index) : _item;

        // skip this item because it must be filtered
        if (ifExpr && !tmpl(ifExpr, extend(create(parent), item))) {
          filteredItemsCount ++;
          return
        }

        var itemId = getItemId(keyAttr, _item, item, hasKeyAttrExpr);
        // reorder only if the items are not objects
        // or a key attribute has been provided
        var doReorder = !isObject && mustReorder && typeof _item === T_OBJECT || keyAttr;
        var oldPos = oldItems.indexOf(itemId);
        var isNew = oldPos === -1;
        var pos = !isNew && doReorder ? oldPos : i;
        // does a tag exist in this position?
        var tag = tags[pos];
        var mustAppend = i >= oldItems.length;
        var mustCreate = doReorder && isNew || !doReorder && !tag || !tags[i];

        // new tag
        if (mustCreate) {
          tag = createTag(impl, {
            parent: parent,
            isLoop: isLoop,
            isAnonymous: isAnonymous,
            tagName: tagName,
            root: dom.cloneNode(isAnonymous),
            item: item,
            index: i,
          }, innerHTML);

          // mount the tag
          tag.mount();

          if (mustAppend)
            { append.apply(tag, [frag || root, isVirtual]); }
          else
            { insert.apply(tag, [root, tags[i], isVirtual]); }

          if (!mustAppend) { oldItems.splice(i, 0, item); }
          tags.splice(i, 0, tag);
          if (child) { arrayishAdd(parent.tags, tagName, tag, true); }
        } else if (pos !== i && doReorder) {
          // move
          if (keyAttr || contains(items, oldItems[pos])) {
            move.apply(tag, [root, tags[i], isVirtual]);
            // move the old tag instance
            tags.splice(i, 0, tags.splice(pos, 1)[0]);
            // move the old item
            oldItems.splice(i, 0, oldItems.splice(pos, 1)[0]);
          }

          // update the position attribute if it exists
          if (expr.pos) { tag[expr.pos] = i; }

          // if the loop tags are not custom
          // we need to move all their custom tags into the right position
          if (!child && tag.tags) { moveNestedTags.call(tag, i); }
        }

        // cache the original item to use it in the events bound to this node
        // and its children
        extend(tag.__, {
          item: item,
          index: i,
          parent: parent
        });

        tmpItems[i] = itemId;

        if (!mustCreate) { tag.update(item); }
      });

      // remove the redundant tags
      unmountRedundant(items, tags, filteredItemsCount);

      // clone the items array
      oldItems = tmpItems.slice();

      root.insertBefore(frag, placeholder);
    };

    expr.unmount = function () {
      each(tags, function (t) { t.unmount(); });
    };

    return expr
  }

  var RefExpr = {
    init: function init(dom, parent, attrName, attrValue) {
      this.dom = dom;
      this.attr = attrName;
      this.rawValue = attrValue;
      this.parent = parent;
      this.hasExp = tmpl.hasExpr(attrValue);
      return this
    },
    update: function update() {
      var old = this.value;
      var customParent = this.parent && getImmediateCustomParent(this.parent);
      // if the referenced element is a custom tag, then we set the tag itself, rather than DOM
      var tagOrDom = this.dom.__ref || this.tag || this.dom;

      this.value = this.hasExp ? tmpl(this.rawValue, this.parent) : this.rawValue;

      // the name changed, so we need to remove it from the old key (if present)
      if (!isBlank(old) && customParent) { arrayishRemove(customParent.refs, old, tagOrDom); }
      if (!isBlank(this.value) && isString(this.value)) {
        // add it to the refs of parent tag (this behavior was changed >=3.0)
        if (customParent) { arrayishAdd(
          customParent.refs,
          this.value,
          tagOrDom,
          // use an array if it's a looped node and the ref is not an expression
          null,
          this.parent.__.index
        ); }

        if (this.value !== old) {
          setAttribute(this.dom, this.attr, this.value);
        }
      } else {
        removeAttribute(this.dom, this.attr);
      }

      // cache the ref bound to this dom node
      // to reuse it in future (see also #2329)
      if (!this.dom.__ref) { this.dom.__ref = tagOrDom; }
    },
    unmount: function unmount() {
      var tagOrDom = this.tag || this.dom;
      var customParent = this.parent && getImmediateCustomParent(this.parent);
      if (!isBlank(this.value) && customParent)
        { arrayishRemove(customParent.refs, this.value, tagOrDom); }
    }
  };

  /**
   * Create a new ref directive
   * @param   { HTMLElement } dom - dom node having the ref attribute
   * @param   { Tag } context - tag instance where the DOM node is located
   * @param   { String } attrName - either 'ref' or 'data-ref'
   * @param   { String } attrValue - value of the ref attribute
   * @returns { RefExpr } a new RefExpr object
   */
  function createRefDirective(dom, tag, attrName, attrValue) {
    return create(RefExpr).init(dom, tag, attrName, attrValue)
  }

  /**
   * Trigger the unmount method on all the expressions
   * @param   { Array } expressions - DOM expressions
   */
  function unmountAll(expressions) {
    each(expressions, function (expr) {
      if (expr.unmount) { expr.unmount(true); }
      else if (expr.tagName) { expr.tag.unmount(true); }
      else if (expr.unmount) { expr.unmount(); }
    });
  }

  var IfExpr = {
    init: function init(dom, tag, expr) {
      removeAttribute(dom, CONDITIONAL_DIRECTIVE);
      extend(this, { tag: tag, expr: expr, stub: createDOMPlaceholder(), pristine: dom });
      var p = dom.parentNode;
      p.insertBefore(this.stub, dom);
      p.removeChild(dom);

      return this
    },
    update: function update$$1() {
      this.value = tmpl(this.expr, this.tag);

      if (!this.stub.parentNode) { return }

      if (this.value && !this.current) { // insert
        this.current = this.pristine.cloneNode(true);
        this.stub.parentNode.insertBefore(this.current, this.stub);
        this.expressions = parseExpressions.apply(this.tag, [this.current, true]);
      } else if (!this.value && this.current) { // remove
        this.unmount();
        this.current = null;
        this.expressions = [];
      }

      if (this.value) { update.call(this.tag, this.expressions); }
    },
    unmount: function unmount() {
      if (this.current) {
        if (this.current._tag) {
          this.current._tag.unmount();
        } else if (this.current.parentNode) {
          this.current.parentNode.removeChild(this.current);
        }
      }

      unmountAll(this.expressions || []);
    }
  };

  /**
   * Create a new if directive
   * @param   { HTMLElement } dom - if root dom node
   * @param   { Tag } context - tag instance where the DOM node is located
   * @param   { String } attr - if expression
   * @returns { IFExpr } a new IfExpr object
   */
  function createIfDirective(dom, tag, attr) {
    return create(IfExpr).init(dom, tag, attr)
  }

  /**
   * Walk the tag DOM to detect the expressions to evaluate
   * @this Tag
   * @param   { HTMLElement } root - root tag where we will start digging the expressions
   * @param   { Boolean } mustIncludeRoot - flag to decide whether the root must be parsed as well
   * @returns { Array } all the expressions found
   */
  function parseExpressions(root, mustIncludeRoot) {
    var this$1 = this;

    var expressions = [];

    walkNodes(root, function (dom) {
      var type = dom.nodeType;
      var attr;
      var tagImpl;

      if (!mustIncludeRoot && dom === root) { return }

      // text node
      if (type === 3 && dom.parentNode.tagName !== 'STYLE' && tmpl.hasExpr(dom.nodeValue))
        { expressions.push({dom: dom, expr: dom.nodeValue}); }

      if (type !== 1) { return }

      var isVirtual = dom.tagName === 'VIRTUAL';

      // loop. each does it's own thing (for now)
      if (attr = getAttribute(dom, LOOP_DIRECTIVE)) {
        if(isVirtual) { setAttribute(dom, 'loopVirtual', true); } // ignore here, handled in _each
        expressions.push(_each(dom, this$1, attr));
        return false
      }

      // if-attrs become the new parent. Any following expressions (either on the current
      // element, or below it) become children of this expression.
      if (attr = getAttribute(dom, CONDITIONAL_DIRECTIVE)) {
        expressions.push(createIfDirective(dom, this$1, attr));
        return false
      }

      if (attr = getAttribute(dom, IS_DIRECTIVE)) {
        if (tmpl.hasExpr(attr)) {
          expressions.push({
            isRtag: true,
            expr: attr,
            dom: dom,
            attrs: [].slice.call(dom.attributes)
          });

          return false
        }
      }

      // if this is a tag, stop traversing here.
      // we ignore the root, since parseExpressions is called while we're mounting that root
      tagImpl = get(dom);

      if(isVirtual) {
        if(getAttribute(dom, 'virtualized')) {dom.parentElement.removeChild(dom); } // tag created, remove from dom
        if(!tagImpl && !getAttribute(dom, 'virtualized') && !getAttribute(dom, 'loopVirtual'))  // ok to create virtual tag
          { tagImpl = { tmpl: dom.outerHTML }; }
      }

      if (tagImpl && (dom !== root || mustIncludeRoot)) {
        var hasIsDirective = getAttribute(dom, IS_DIRECTIVE);
        if(isVirtual && !hasIsDirective) { // handled in update
          // can not remove attribute like directives
          // so flag for removal after creation to prevent maximum stack error
          setAttribute(dom, 'virtualized', true);
          var tag = createTag(
            {tmpl: dom.outerHTML},
            {root: dom, parent: this$1},
            dom.innerHTML
          );

          expressions.push(tag); // no return, anonymous tag, keep parsing
        } else {
          if (hasIsDirective && isVirtual)
            { warn(("Virtual tags shouldn't be used together with the \"" + IS_DIRECTIVE + "\" attribute - https://github.com/riot/riot/issues/2511")); }

          expressions.push(
            initChild(
              tagImpl,
              {
                root: dom,
                parent: this$1
              },
              dom.innerHTML,
              this$1
            )
          );
          return false
        }
      }

      // attribute expressions
      parseAttributes.apply(this$1, [dom, dom.attributes, function (attr, expr) {
        if (!expr) { return }
        expressions.push(expr);
      }]);
    });

    return expressions
  }

  /**
   * Calls `fn` for every attribute on an element. If that attr has an expression,
   * it is also passed to fn.
   * @this Tag
   * @param   { HTMLElement } dom - dom node to parse
   * @param   { Array } attrs - array of attributes
   * @param   { Function } fn - callback to exec on any iteration
   */
  function parseAttributes(dom, attrs, fn) {
    var this$1 = this;

    each(attrs, function (attr) {
      if (!attr) { return false }

      var name = attr.name;
      var bool = isBoolAttr(name);
      var expr;

      if (contains(REF_DIRECTIVES, name) && dom.tagName.toLowerCase() !== YIELD_TAG) {
        expr =  createRefDirective(dom, this$1, name, attr.value);
      } else if (tmpl.hasExpr(attr.value)) {
        expr = {dom: dom, expr: attr.value, attr: name, bool: bool};
      }

      fn(attr, expr);
    });
  }

  /**
   * Manage the mount state of a tag triggering also the observable events
   * @this Tag
   * @param { Boolean } value - ..of the isMounted flag
   */
  function setMountState(value) {
    var ref = this.__;
    var isAnonymous = ref.isAnonymous;
    var skipAnonymous = ref.skipAnonymous;

    define(this, 'isMounted', value);

    if (!isAnonymous || !skipAnonymous) {
      if (value) { this.trigger('mount'); }
      else {
        this.trigger('unmount');
        this.off('*');
        this.__.wasCreated = false;
      }
    }
  }

  /**
   * Mount the current tag instance
   * @returns { Tag } the current tag instance
   */
  function componentMount(tag$$1, dom, expressions, opts) {
    var __ = tag$$1.__;
    var root = __.root;
    root._tag = tag$$1; // keep a reference to the tag just created

    // Read all the attrs on this instance. This give us the info we need for updateOpts
    parseAttributes.apply(__.parent, [root, root.attributes, function (attr, expr) {
      if (!__.isAnonymous && RefExpr.isPrototypeOf(expr)) { expr.tag = tag$$1; }
      attr.expr = expr;
      __.instAttrs.push(attr);
    }]);

    // update the root adding custom attributes coming from the compiler
    walkAttributes(__.impl.attrs, function (k, v) { __.implAttrs.push({name: k, value: v}); });
    parseAttributes.apply(tag$$1, [root, __.implAttrs, function (attr, expr) {
      if (expr) { expressions.push(expr); }
      else { setAttribute(root, attr.name, attr.value); }
    }]);

    // initialiation
    updateOpts.apply(tag$$1, [__.isLoop, __.parent, __.isAnonymous, opts, __.instAttrs]);

    // add global mixins
    var globalMixin = mixin(GLOBAL_MIXIN);

    if (globalMixin && !__.skipAnonymous) {
      for (var i in globalMixin) {
        if (globalMixin.hasOwnProperty(i)) {
          tag$$1.mixin(globalMixin[i]);
        }
      }
    }

    if (__.impl.fn) { __.impl.fn.call(tag$$1, opts); }

    if (!__.skipAnonymous) { tag$$1.trigger('before-mount'); }

    // parse layout after init. fn may calculate args for nested custom tags
    each(parseExpressions.apply(tag$$1, [dom, __.isAnonymous]), function (e) { return expressions.push(e); });

    tag$$1.update(__.item);

    if (!__.isAnonymous && !__.isInline) {
      while (dom.firstChild) { root.appendChild(dom.firstChild); }
    }

    define(tag$$1, 'root', root);

    // if we need to wait that the parent "mount" or "updated" event gets triggered
    if (!__.skipAnonymous && tag$$1.parent) {
      var p = getImmediateCustomParent(tag$$1.parent);
      p.one(!p.isMounted ? 'mount' : 'updated', function () {
        setMountState.call(tag$$1, true);
      });
    } else {
      // otherwise it's not a child tag we can trigger its mount event
      setMountState.call(tag$$1, true);
    }

    tag$$1.__.wasCreated = true;

    return tag$$1
  }

  /**
   * Unmount the tag instance
   * @param { Boolean } mustKeepRoot - if it's true the root node will not be removed
   * @returns { Tag } the current tag instance
   */
  function tagUnmount(tag, mustKeepRoot, expressions) {
    var __ = tag.__;
    var root = __.root;
    var tagIndex = __TAGS_CACHE.indexOf(tag);
    var p = root.parentNode;

    if (!__.skipAnonymous) { tag.trigger('before-unmount'); }

    // clear all attributes coming from the mounted tag
    walkAttributes(__.impl.attrs, function (name) {
      if (startsWith(name, ATTRS_PREFIX))
        { name = name.slice(ATTRS_PREFIX.length); }

      removeAttribute(root, name);
    });

    // remove all the event listeners
    tag.__.listeners.forEach(function (dom) {
      Object.keys(dom[RIOT_EVENTS_KEY]).forEach(function (eventName) {
        dom.removeEventListener(eventName, dom[RIOT_EVENTS_KEY][eventName]);
      });
    });

    // remove tag instance from the global tags cache collection
    if (tagIndex !== -1) { __TAGS_CACHE.splice(tagIndex, 1); }

    // clean up the parent tags object
    if (__.parent && !__.isAnonymous) {
      var ptag = getImmediateCustomParent(__.parent);

      if (__.isVirtual) {
        Object
          .keys(tag.tags)
          .forEach(function (tagName) { return arrayishRemove(ptag.tags, tagName, tag.tags[tagName]); });
      } else {
        arrayishRemove(ptag.tags, __.tagName, tag);
      }
    }

    // unmount all the virtual directives
    if (tag.__.virts) {
      each(tag.__.virts, function (v) {
        if (v.parentNode) { v.parentNode.removeChild(v); }
      });
    }

    // allow expressions to unmount themselves
    unmountAll(expressions);
    each(__.instAttrs, function (a) { return a.expr && a.expr.unmount && a.expr.unmount(); });

    // clear the tag html if it's necessary
    if (mustKeepRoot) { setInnerHTML(root, ''); }
    // otherwise detach the root tag from the DOM
    else if (p) { p.removeChild(root); }

    // custom internal unmount function to avoid relying on the observable
    if (__.onUnmount) { __.onUnmount(); }

    // weird fix for a weird edge case #2409 and #2436
    // some users might use your software not as you've expected
    // so I need to add these dirty hacks to mitigate unexpected issues
    if (!tag.isMounted) { setMountState.call(tag, true); }

    setMountState.call(tag, false);

    delete root._tag;

    return tag
  }

  /**
   * Tag creation factory function
   * @constructor
   * @param { Object } impl - it contains the tag template, and logic
   * @param { Object } conf - tag options
   * @param { String } innerHTML - html that eventually we need to inject in the tag
   */
  function createTag(impl, conf, innerHTML) {
    if ( impl === void 0 ) impl = {};
    if ( conf === void 0 ) conf = {};

    var tag = conf.context || {};
    var opts = conf.opts || {};
    var parent = conf.parent;
    var isLoop = conf.isLoop;
    var isAnonymous = !!conf.isAnonymous;
    var skipAnonymous = settings.skipAnonymousTags && isAnonymous;
    var item = conf.item;
    // available only for the looped nodes
    var index = conf.index;
    // All attributes on the Tag when it's first parsed
    var instAttrs = [];
    // expressions on this type of Tag
    var implAttrs = [];
    var tmpl = impl.tmpl;
    var expressions = [];
    var root = conf.root;
    var tagName = conf.tagName || getName(root);
    var isVirtual = tagName === 'virtual';
    var isInline = !isVirtual && !tmpl;
    var dom;

    if (isInline || isLoop && isAnonymous) {
      dom = root;
    } else {
      if (!isVirtual) { root.innerHTML = ''; }
      dom = mkdom(tmpl, innerHTML, isSvg(root));
    }

    // make this tag observable
    if (!skipAnonymous) { observable(tag); }

    // only call unmount if we have a valid __TAG_IMPL (has name property)
    if (impl.name && root._tag) { root._tag.unmount(true); }

    define(tag, '__', {
      impl: impl,
      root: root,
      skipAnonymous: skipAnonymous,
      implAttrs: implAttrs,
      isAnonymous: isAnonymous,
      instAttrs: instAttrs,
      innerHTML: innerHTML,
      tagName: tagName,
      index: index,
      isLoop: isLoop,
      isInline: isInline,
      item: item,
      parent: parent,
      // tags having event listeners
      // it would be better to use weak maps here but we can not introduce breaking changes now
      listeners: [],
      // these vars will be needed only for the virtual tags
      virts: [],
      wasCreated: false,
      tail: null,
      head: null
    });

    // tag protected properties
    return [
      ['isMounted', false],
      // create a unique id to this tag
      // it could be handy to use it also to improve the virtual dom rendering speed
      ['_riot_id', uid()],
      ['root', root],
      ['opts', opts, { writable: true, enumerable: true }],
      ['parent', parent || null],
      // protect the "tags" and "refs" property from being overridden
      ['tags', {}],
      ['refs', {}],
      ['update', function (data) { return componentUpdate(tag, data, expressions); }],
      ['mixin', function () {
        var mixins = [], len = arguments.length;
        while ( len-- ) mixins[ len ] = arguments[ len ];

        return componentMixin.apply(void 0, [ tag ].concat( mixins ));
    }],
      ['mount', function () { return componentMount(tag, dom, expressions, opts); }],
      ['unmount', function (mustKeepRoot) { return tagUnmount(tag, mustKeepRoot, expressions); }]
    ].reduce(function (acc, ref) {
      var key = ref[0];
      var value = ref[1];
      var opts = ref[2];

      define(tag, key, value, opts);
      return acc
    }, extend(tag, item))
  }

  /**
   * Mount a tag creating new Tag instance
   * @param   { Object } root - dom node where the tag will be mounted
   * @param   { String } tagName - name of the riot tag we want to mount
   * @param   { Object } opts - options to pass to the Tag instance
   * @param   { Object } ctx - optional context that will be used to extend an existing class ( used in riot.Tag )
   * @returns { Tag } a new Tag instance
   */
  function mount$1(root, tagName, opts, ctx) {
    var impl = __TAG_IMPL[tagName];
    var implClass = __TAG_IMPL[tagName].class;
    var context = ctx || (implClass ? create(implClass.prototype) : {});
    // cache the inner HTML to fix #855
    var innerHTML = root._innerHTML = root._innerHTML || root.innerHTML;
    var conf = extend({ root: root, opts: opts, context: context }, { parent: opts ? opts.parent : null });
    var tag;

    if (impl && root) { tag = createTag(impl, conf, innerHTML); }

    if (tag && tag.mount) {
      tag.mount(true);
      // add this tag to the virtualDom variable
      if (!contains(__TAGS_CACHE, tag)) { __TAGS_CACHE.push(tag); }
    }

    return tag
  }



  var tags = /*#__PURE__*/Object.freeze({
    arrayishAdd: arrayishAdd,
    getTagName: getName,
    inheritParentProps: inheritParentProps,
    mountTo: mount$1,
    selectTags: query,
    arrayishRemove: arrayishRemove,
    getTag: get,
    initChildTag: initChild,
    moveChildTag: moveChild,
    makeReplaceVirtual: makeReplaceVirtual,
    getImmediateCustomParentTag: getImmediateCustomParent,
    makeVirtual: makeVirtual,
    moveVirtual: moveVirtual,
    unmountAll: unmountAll,
    createIfDirective: createIfDirective,
    createRefDirective: createRefDirective
  });

  /**
   * Riot public api
   */
  var settings$1 = settings;
  var util = {
    tmpl: tmpl,
    brackets: brackets,
    styleManager: styleManager,
    vdom: __TAGS_CACHE,
    styleNode: styleManager.styleNode,
    // export the riot internal utils as well
    dom: dom,
    check: check,
    misc: misc,
    tags: tags
  };

  // export the core props/methods
  var Tag$1 = Tag;
  var tag$1 = tag;
  var tag2$1 = tag2;
  var mount$2 = mount;
  var mixin$1 = mixin;
  var update$2 = update$1;
  var unregister$1 = unregister;
  var version$1 = version;
  var observable$1 = observable;

  var riot$1 = extend({}, core, {
    observable: observable,
    settings: settings$1,
    util: util,
  });

  exports.settings = settings$1;
  exports.util = util;
  exports.Tag = Tag$1;
  exports.tag = tag$1;
  exports.tag2 = tag2$1;
  exports.mount = mount$2;
  exports.mixin = mixin$1;
  exports.update = update$2;
  exports.unregister = unregister$1;
  exports.version = version$1;
  exports.observable = observable$1;
  exports.default = riot$1;

  Object.defineProperty(exports, '__esModule', { value: true });

})));

},{}],2:[function(require,module,exports){
const riot = require('riot');
//include tags
require('./tag/app.tag.pug');

//mount
riot.mount('*');
},{"./tag/app.tag.pug":3,"riot":1}],3:[function(require,module,exports){
var riot = require('riot');
module.exports = 
riot.tag2('app', '<div class="test"> <h1>app.tag</h1> <button click="{clicked}">count: {this.list.length}</button> <ul> <li each="{item, index in list}">{index}: {item}</li> </ul> </div>', 'app .test,[data-is="app"] .test{ background-color: #ddd; }', '', function(opts) {
    this.list = []

    this.on('mount', () => {
        console.log('TEST app.tag mounted', opts)
    })

    this.clicked = function(e) {
        this.list.push(new Date().toString())
    }.bind(this)
});

},{"riot":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvcmlvdC9yaW90LmpzIiwic3JjL21haW4uanMiLCIvVXNlcnMveXVraXNoaXJvdGEvZGV2L2Zyb250RnJhbWVXb3JrRGV2L1Jpb3RDbGllbnQvc3JjL3RhZy9hcHAudGFnLnB1ZyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BpR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztDQ0RRLEFBQ0ksQUFLSixBQVdBO0NBUkE7Q0FFQTtDQWRKLEFBQ0ksQUFLSixBQUNJLEFBQ0ksQUFPQSxrQkFoQlo7Q0FpQlE7Q0FkQSxBQWdCQTtDQVBKLEFBUVEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKiBSaW90IHYzLjEzLjIsIEBsaWNlbnNlIE1JVCAqL1xuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gZmFjdG9yeShleHBvcnRzKSA6XG4gIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShbJ2V4cG9ydHMnXSwgZmFjdG9yeSkgOlxuICAoZmFjdG9yeSgoZ2xvYmFsLnJpb3QgPSB7fSkpKTtcbn0odGhpcywgKGZ1bmN0aW9uIChleHBvcnRzKSB7ICd1c2Ugc3RyaWN0JztcblxuICAvKipcbiAgICogU2hvcnRlciBhbmQgZmFzdCB3YXkgdG8gc2VsZWN0IGEgc2luZ2xlIG5vZGUgaW4gdGhlIERPTVxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IHNlbGVjdG9yIC0gdW5pcXVlIGRvbSBzZWxlY3RvclxuICAgKiBAcGFyYW0gICB7IE9iamVjdCB9IGN0eCAtIERPTSBub2RlIHdoZXJlIHRoZSB0YXJnZXQgb2Ygb3VyIHNlYXJjaCB3aWxsIGlzIGxvY2F0ZWRcbiAgICogQHJldHVybnMgeyBPYmplY3QgfSBkb20gbm9kZSBmb3VuZFxuICAgKi9cbiAgZnVuY3Rpb24gJChzZWxlY3RvciwgY3R4KSB7XG4gICAgcmV0dXJuIChjdHggfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpXG4gIH1cblxuICB2YXJcbiAgICAvLyBiZSBhd2FyZSwgaW50ZXJuYWwgdXNhZ2VcbiAgICAvLyBBVFRFTlRJT046IHByZWZpeCB0aGUgZ2xvYmFsIGR5bmFtaWMgdmFyaWFibGVzIHdpdGggYF9fYFxuICAgIC8vIHRhZ3MgaW5zdGFuY2VzIGNhY2hlXG4gICAgX19UQUdTX0NBQ0hFID0gW10sXG4gICAgLy8gdGFncyBpbXBsZW1lbnRhdGlvbiBjYWNoZVxuICAgIF9fVEFHX0lNUEwgPSB7fSxcbiAgICBZSUVMRF9UQUcgPSAneWllbGQnLFxuXG4gICAgLyoqXG4gICAgICogQ29uc3RcbiAgICAgKi9cbiAgICBHTE9CQUxfTUlYSU4gPSAnX19nbG9iYWxfbWl4aW4nLFxuXG4gICAgLy8gcmlvdCBzcGVjaWZpYyBwcmVmaXhlcyBvciBhdHRyaWJ1dGVzXG4gICAgQVRUUlNfUFJFRklYID0gJ3Jpb3QtJyxcblxuICAgIC8vIFJpb3QgRGlyZWN0aXZlc1xuICAgIFJFRl9ESVJFQ1RJVkVTID0gWydyZWYnLCAnZGF0YS1yZWYnXSxcbiAgICBJU19ESVJFQ1RJVkUgPSAnZGF0YS1pcycsXG4gICAgQ09ORElUSU9OQUxfRElSRUNUSVZFID0gJ2lmJyxcbiAgICBMT09QX0RJUkVDVElWRSA9ICdlYWNoJyxcbiAgICBMT09QX05PX1JFT1JERVJfRElSRUNUSVZFID0gJ25vLXJlb3JkZXInLFxuICAgIFNIT1dfRElSRUNUSVZFID0gJ3Nob3cnLFxuICAgIEhJREVfRElSRUNUSVZFID0gJ2hpZGUnLFxuICAgIEtFWV9ESVJFQ1RJVkUgPSAna2V5JyxcbiAgICBSSU9UX0VWRU5UU19LRVkgPSAnX19yaW90LWV2ZW50c19fJyxcblxuICAgIC8vIGZvciB0eXBlb2YgPT0gJycgY29tcGFyaXNvbnNcbiAgICBUX1NUUklORyA9ICdzdHJpbmcnLFxuICAgIFRfT0JKRUNUID0gJ29iamVjdCcsXG4gICAgVF9VTkRFRiAgPSAndW5kZWZpbmVkJyxcbiAgICBUX0ZVTkNUSU9OID0gJ2Z1bmN0aW9uJyxcblxuICAgIFhMSU5LX05TID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnLFxuICAgIFNWR19OUyA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsXG4gICAgWExJTktfUkVHRVggPSAvXnhsaW5rOihcXHcrKS8sXG5cbiAgICBXSU4gPSB0eXBlb2Ygd2luZG93ID09PSBUX1VOREVGID8gLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi8gdW5kZWZpbmVkIDogd2luZG93LFxuXG4gICAgLy8gc3BlY2lhbCBuYXRpdmUgdGFncyB0aGF0IGNhbm5vdCBiZSB0cmVhdGVkIGxpa2UgdGhlIG90aGVyc1xuICAgIFJFX1NQRUNJQUxfVEFHUyA9IC9eKD86dCg/OmJvZHl8aGVhZHxmb290fFtyaGRdKXxjYXB0aW9ufGNvbCg/Omdyb3VwKT98b3B0KD86aW9ufGdyb3VwKSkkLyxcbiAgICBSRV9TUEVDSUFMX1RBR1NfTk9fT1BUSU9OID0gL14oPzp0KD86Ym9keXxoZWFkfGZvb3R8W3JoZF0pfGNhcHRpb258Y29sKD86Z3JvdXApPykkLyxcbiAgICBSRV9FVkVOVFNfUFJFRklYID0gL15vbi8sXG4gICAgUkVfSFRNTF9BVFRSUyA9IC8oWy1cXHddKykgPz0gPyg/OlwiKFteXCJdKil8JyhbXiddKil8KHtbXn1dKn0pKS9nLFxuICAgIC8vIHNvbWUgRE9NIGF0dHJpYnV0ZXMgbXVzdCBiZSBub3JtYWxpemVkXG4gICAgQ0FTRV9TRU5TSVRJVkVfQVRUUklCVVRFUyA9IHtcbiAgICAgICd2aWV3Ym94JzogJ3ZpZXdCb3gnLFxuICAgICAgJ3ByZXNlcnZlYXNwZWN0cmF0aW8nOiAncHJlc2VydmVBc3BlY3RSYXRpbydcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIE1hdGNoZXMgYm9vbGVhbiBIVE1MIGF0dHJpYnV0ZXMgaW4gdGhlIHJpb3QgdGFnIGRlZmluaXRpb24uXG4gICAgICogV2l0aCBhIGxvbmcgbGlzdCBsaWtlIHRoaXMsIGEgcmVnZXggaXMgZmFzdGVyIHRoYW4gYFtdLmluZGV4T2ZgIGluIG1vc3QgYnJvd3NlcnMuXG4gICAgICogQGNvbnN0IHtSZWdFeHB9XG4gICAgICogQHNlZSBbYXR0cmlidXRlcy5tZF0oaHR0cHM6Ly9naXRodWIuY29tL3Jpb3QvY29tcGlsZXIvYmxvYi9kZXYvZG9jL2F0dHJpYnV0ZXMubWQpXG4gICAgICovXG4gICAgUkVfQk9PTF9BVFRSUyA9IC9eKD86ZGlzYWJsZWR8Y2hlY2tlZHxyZWFkb25seXxyZXF1aXJlZHxhbGxvd2Z1bGxzY3JlZW58YXV0byg/OmZvY3VzfHBsYXkpfGNvbXBhY3R8Y29udHJvbHN8ZGVmYXVsdHxmb3Jtbm92YWxpZGF0ZXxoaWRkZW58aXNtYXB8aXRlbXNjb3BlfGxvb3B8bXVsdGlwbGV8bXV0ZWR8bm8oPzpyZXNpemV8c2hhZGV8dmFsaWRhdGV8d3JhcCk/fG9wZW58cmV2ZXJzZWR8c2VhbWxlc3N8c2VsZWN0ZWR8c29ydGFibGV8dHJ1ZXNwZWVkfHR5cGVtdXN0bWF0Y2gpJC8sXG4gICAgLy8gdmVyc2lvbiMgZm9yIElFIDgtMTEsIDAgZm9yIG90aGVyc1xuICAgIElFX1ZFUlNJT04gPSAoV0lOICYmIFdJTi5kb2N1bWVudCB8fCAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyB7fSkuZG9jdW1lbnRNb2RlIHwgMDtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgZ2VuZXJpYyBET00gbm9kZVxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IG5hbWUgLSBuYW1lIG9mIHRoZSBET00gbm9kZSB3ZSB3YW50IHRvIGNyZWF0ZVxuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IERPTSBub2RlIGp1c3QgY3JlYXRlZFxuICAgKi9cbiAgZnVuY3Rpb24gbWFrZUVsZW1lbnQobmFtZSkge1xuICAgIHJldHVybiBuYW1lID09PSAnc3ZnJyA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTlMsIG5hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChuYW1lKVxuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhbnkgRE9NIGF0dHJpYnV0ZVxuICAgKiBAcGFyYW0geyBPYmplY3QgfSBkb20gLSBET00gbm9kZSB3ZSB3YW50IHRvIHVwZGF0ZVxuICAgKiBAcGFyYW0geyBTdHJpbmcgfSBuYW1lIC0gbmFtZSBvZiB0aGUgcHJvcGVydHkgd2Ugd2FudCB0byBzZXRcbiAgICogQHBhcmFtIHsgU3RyaW5nIH0gdmFsIC0gdmFsdWUgb2YgdGhlIHByb3BlcnR5IHdlIHdhbnQgdG8gc2V0XG4gICAqL1xuICBmdW5jdGlvbiBzZXRBdHRyaWJ1dGUoZG9tLCBuYW1lLCB2YWwpIHtcbiAgICB2YXIgeGxpbmsgPSBYTElOS19SRUdFWC5leGVjKG5hbWUpO1xuICAgIGlmICh4bGluayAmJiB4bGlua1sxXSlcbiAgICAgIHsgZG9tLnNldEF0dHJpYnV0ZU5TKFhMSU5LX05TLCB4bGlua1sxXSwgdmFsKTsgfVxuICAgIGVsc2VcbiAgICAgIHsgZG9tLnNldEF0dHJpYnV0ZShuYW1lLCB2YWwpOyB9XG4gIH1cblxuICB2YXIgc3R5bGVOb2RlO1xuICAvLyBDcmVhdGUgY2FjaGUgYW5kIHNob3J0Y3V0IHRvIHRoZSBjb3JyZWN0IHByb3BlcnR5XG4gIHZhciBjc3NUZXh0UHJvcDtcbiAgdmFyIGJ5TmFtZSA9IHt9O1xuICB2YXIgbmVlZHNJbmplY3QgPSBmYWxzZTtcblxuICAvLyBza2lwIHRoZSBmb2xsb3dpbmcgY29kZSBvbiB0aGUgc2VydmVyXG4gIGlmIChXSU4pIHtcbiAgICBzdHlsZU5vZGUgPSAoKGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIGNyZWF0ZSBhIG5ldyBzdHlsZSBlbGVtZW50IHdpdGggdGhlIGNvcnJlY3QgdHlwZVxuICAgICAgdmFyIG5ld05vZGUgPSBtYWtlRWxlbWVudCgnc3R5bGUnKTtcbiAgICAgIC8vIHJlcGxhY2UgYW55IHVzZXIgbm9kZSBvciBpbnNlcnQgdGhlIG5ldyBvbmUgaW50byB0aGUgaGVhZFxuICAgICAgdmFyIHVzZXJOb2RlID0gJCgnc3R5bGVbdHlwZT1yaW90XScpO1xuXG4gICAgICBzZXRBdHRyaWJ1dGUobmV3Tm9kZSwgJ3R5cGUnLCAndGV4dC9jc3MnKTtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICBpZiAodXNlck5vZGUpIHtcbiAgICAgICAgaWYgKHVzZXJOb2RlLmlkKSB7IG5ld05vZGUuaWQgPSB1c2VyTm9kZS5pZDsgfVxuICAgICAgICB1c2VyTm9kZS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCB1c2VyTm9kZSk7XG4gICAgICB9IGVsc2UgeyBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKG5ld05vZGUpOyB9XG5cbiAgICAgIHJldHVybiBuZXdOb2RlXG4gICAgfSkpKCk7XG4gICAgY3NzVGV4dFByb3AgPSBzdHlsZU5vZGUuc3R5bGVTaGVldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBPYmplY3QgdGhhdCB3aWxsIGJlIHVzZWQgdG8gaW5qZWN0IGFuZCBtYW5hZ2UgdGhlIGNzcyBvZiBldmVyeSB0YWcgaW5zdGFuY2VcbiAgICovXG4gIHZhciBzdHlsZU1hbmFnZXIgPSB7XG4gICAgc3R5bGVOb2RlOiBzdHlsZU5vZGUsXG4gICAgLyoqXG4gICAgICogU2F2ZSBhIHRhZyBzdHlsZSB0byBiZSBsYXRlciBpbmplY3RlZCBpbnRvIERPTVxuICAgICAqIEBwYXJhbSB7IFN0cmluZyB9IGNzcyAtIGNzcyBzdHJpbmdcbiAgICAgKiBAcGFyYW0geyBTdHJpbmcgfSBuYW1lIC0gaWYgaXQncyBwYXNzZWQgd2Ugd2lsbCBtYXAgdGhlIGNzcyB0byBhIHRhZ25hbWVcbiAgICAgKi9cbiAgICBhZGQ6IGZ1bmN0aW9uIGFkZChjc3MsIG5hbWUpIHtcbiAgICAgIGJ5TmFtZVtuYW1lXSA9IGNzcztcbiAgICAgIG5lZWRzSW5qZWN0ID0gdHJ1ZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEluamVjdCBhbGwgcHJldmlvdXNseSBzYXZlZCB0YWcgc3R5bGVzIGludG8gRE9NXG4gICAgICogaW5uZXJIVE1MIHNlZW1zIHNsb3c6IGh0dHA6Ly9qc3BlcmYuY29tL3Jpb3QtaW5zZXJ0LXN0eWxlXG4gICAgICovXG4gICAgaW5qZWN0OiBmdW5jdGlvbiBpbmplY3QoKSB7XG4gICAgICBpZiAoIVdJTiB8fCAhbmVlZHNJbmplY3QpIHsgcmV0dXJuIH1cbiAgICAgIG5lZWRzSW5qZWN0ID0gZmFsc2U7XG4gICAgICB2YXIgc3R5bGUgPSBPYmplY3Qua2V5cyhieU5hbWUpXG4gICAgICAgIC5tYXAoZnVuY3Rpb24gKGspIHsgcmV0dXJuIGJ5TmFtZVtrXTsgfSlcbiAgICAgICAgLmpvaW4oJ1xcbicpO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIGlmIChjc3NUZXh0UHJvcCkgeyBjc3NUZXh0UHJvcC5jc3NUZXh0ID0gc3R5bGU7IH1cbiAgICAgIGVsc2UgeyBzdHlsZU5vZGUuaW5uZXJIVE1MID0gc3R5bGU7IH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGEgdGFnIHN0eWxlIG9mIGluamVjdGVkIERPTSBsYXRlci5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBhIHJlZ2lzdGVyZWQgdGFnbmFtZVxuICAgICAqL1xuICAgIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKG5hbWUpIHtcbiAgICAgIGRlbGV0ZSBieU5hbWVbbmFtZV07XG4gICAgICBuZWVkc0luamVjdCA9IHRydWU7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBUaGUgcmlvdCB0ZW1wbGF0ZSBlbmdpbmVcbiAgICogQHZlcnNpb24gdjMuMC44XG4gICAqL1xuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIHZhciBza2lwUmVnZXggPSAoZnVuY3Rpb24gKCkgeyAvL2VzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcblxuICAgIHZhciBiZWZvcmVSZUNoYXJzID0gJ1t7KCw7Oj89fCYhXn4+JSovJztcblxuICAgIHZhciBiZWZvcmVSZVdvcmRzID0gW1xuICAgICAgJ2Nhc2UnLFxuICAgICAgJ2RlZmF1bHQnLFxuICAgICAgJ2RvJyxcbiAgICAgICdlbHNlJyxcbiAgICAgICdpbicsXG4gICAgICAnaW5zdGFuY2VvZicsXG4gICAgICAncHJlZml4JyxcbiAgICAgICdyZXR1cm4nLFxuICAgICAgJ3R5cGVvZicsXG4gICAgICAndm9pZCcsXG4gICAgICAneWllbGQnXG4gICAgXTtcblxuICAgIHZhciB3b3Jkc0xhc3RDaGFyID0gYmVmb3JlUmVXb3Jkcy5yZWR1Y2UoZnVuY3Rpb24gKHMsIHcpIHtcbiAgICAgIHJldHVybiBzICsgdy5zbGljZSgtMSlcbiAgICB9LCAnJyk7XG5cbiAgICB2YXIgUkVfUkVHRVggPSAvXlxcLyg/PVteKj4vXSlbXlsvXFxcXF0qKD86KD86XFxcXC58XFxbKD86XFxcXC58W15cXF1cXFxcXSopKlxcXSlbXltcXFxcL10qKSo/XFwvW2dpbXV5XSovO1xuICAgIHZhciBSRV9WTl9DSEFSID0gL1skXFx3XS87XG5cbiAgICBmdW5jdGlvbiBwcmV2IChjb2RlLCBwb3MpIHtcbiAgICAgIHdoaWxlICgtLXBvcyA+PSAwICYmIC9cXHMvLnRlc3QoY29kZVtwb3NdKSl7IH1cbiAgICAgIHJldHVybiBwb3NcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfc2tpcFJlZ2V4IChjb2RlLCBzdGFydCkge1xuXG4gICAgICB2YXIgcmUgPSAvLiovZztcbiAgICAgIHZhciBwb3MgPSByZS5sYXN0SW5kZXggPSBzdGFydCsrO1xuICAgICAgdmFyIG1hdGNoID0gcmUuZXhlYyhjb2RlKVswXS5tYXRjaChSRV9SRUdFWCk7XG5cbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICB2YXIgbmV4dCA9IHBvcyArIG1hdGNoWzBdLmxlbmd0aDtcblxuICAgICAgICBwb3MgPSBwcmV2KGNvZGUsIHBvcyk7XG4gICAgICAgIHZhciBjID0gY29kZVtwb3NdO1xuXG4gICAgICAgIGlmIChwb3MgPCAwIHx8IH5iZWZvcmVSZUNoYXJzLmluZGV4T2YoYykpIHtcbiAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGMgPT09ICcuJykge1xuXG4gICAgICAgICAgaWYgKGNvZGVbcG9zIC0gMV0gPT09ICcuJykge1xuICAgICAgICAgICAgc3RhcnQgPSBuZXh0O1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICcrJyB8fCBjID09PSAnLScpIHtcblxuICAgICAgICAgIGlmIChjb2RlWy0tcG9zXSAhPT0gYyB8fFxuICAgICAgICAgICAgICAocG9zID0gcHJldihjb2RlLCBwb3MpKSA8IDAgfHxcbiAgICAgICAgICAgICAgIVJFX1ZOX0NIQVIudGVzdChjb2RlW3Bvc10pKSB7XG4gICAgICAgICAgICBzdGFydCA9IG5leHQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAofndvcmRzTGFzdENoYXIuaW5kZXhPZihjKSkge1xuXG4gICAgICAgICAgdmFyIGVuZCA9IHBvcyArIDE7XG5cbiAgICAgICAgICB3aGlsZSAoLS1wb3MgPj0gMCAmJiBSRV9WTl9DSEFSLnRlc3QoY29kZVtwb3NdKSl7IH1cbiAgICAgICAgICBpZiAofmJlZm9yZVJlV29yZHMuaW5kZXhPZihjb2RlLnNsaWNlKHBvcyArIDEsIGVuZCkpKSB7XG4gICAgICAgICAgICBzdGFydCA9IG5leHQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzdGFydFxuICAgIH1cblxuICAgIHJldHVybiBfc2tpcFJlZ2V4XG5cbiAgfSkoKTtcblxuICAvKipcbiAgICogcmlvdC51dGlsLmJyYWNrZXRzXG4gICAqXG4gICAqIC0gYGJyYWNrZXRzICAgIGAgLSBSZXR1cm5zIGEgc3RyaW5nIG9yIHJlZ2V4IGJhc2VkIG9uIGl0cyBwYXJhbWV0ZXJcbiAgICogLSBgYnJhY2tldHMuc2V0YCAtIENoYW5nZSB0aGUgY3VycmVudCByaW90IGJyYWNrZXRzXG4gICAqXG4gICAqIEBtb2R1bGVcbiAgICovXG5cbiAgLyogZ2xvYmFsIHJpb3QgKi9cblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICB2YXIgYnJhY2tldHMgPSAoZnVuY3Rpb24gKFVOREVGKSB7XG5cbiAgICB2YXJcbiAgICAgIFJFR0xPQiA9ICdnJyxcblxuICAgICAgUl9NTENPTU1TID0gL1xcL1xcKlteKl0qXFwqKyg/OlteKlxcL11bXipdKlxcKispKlxcLy9nLFxuXG4gICAgICBSX1NUUklOR1MgPSAvXCJbXlwiXFxcXF0qKD86XFxcXFtcXFNcXHNdW15cIlxcXFxdKikqXCJ8J1teJ1xcXFxdKig/OlxcXFxbXFxTXFxzXVteJ1xcXFxdKikqJ3xgW15gXFxcXF0qKD86XFxcXFtcXFNcXHNdW15gXFxcXF0qKSpgL2csXG5cbiAgICAgIFNfUUJMT0NLUyA9IFJfU1RSSU5HUy5zb3VyY2UgKyAnfCcgK1xuICAgICAgICAvKD86XFxicmV0dXJuXFxzK3woPzpbJFxcd1xcKVxcXV18XFwrXFwrfC0tKVxccyooXFwvKSg/IVsqXFwvXSkpLy5zb3VyY2UgKyAnfCcgK1xuICAgICAgICAvXFwvKD89W14qXFwvXSlbXltcXC9cXFxcXSooPzooPzpcXFsoPzpcXFxcLnxbXlxcXVxcXFxdKikqXFxdfFxcXFwuKVteW1xcL1xcXFxdKikqPyhbXjxdXFwvKVtnaW1dKi8uc291cmNlLFxuXG4gICAgICBVTlNVUFBPUlRFRCA9IFJlZ0V4cCgnW1xcXFwnICsgJ3gwMC1cXFxceDFGPD5hLXpBLVowLTlcXCdcIiw7XFxcXFxcXFxdJyksXG5cbiAgICAgIE5FRURfRVNDQVBFID0gLyg/PVtbXFxdKCkqKz8uXiR8XSkvZyxcblxuICAgICAgU19RQkxPQ0syID0gUl9TVFJJTkdTLnNvdXJjZSArICd8JyArIC8oXFwvKSg/IVsqXFwvXSkvLnNvdXJjZSxcblxuICAgICAgRklOREJSQUNFUyA9IHtcbiAgICAgICAgJygnOiBSZWdFeHAoJyhbKCldKXwnICAgKyBTX1FCTE9DSzIsIFJFR0xPQiksXG4gICAgICAgICdbJzogUmVnRXhwKCcoW1tcXFxcXV0pfCcgKyBTX1FCTE9DSzIsIFJFR0xPQiksXG4gICAgICAgICd7JzogUmVnRXhwKCcoW3t9XSl8JyAgICsgU19RQkxPQ0syLCBSRUdMT0IpXG4gICAgICB9LFxuXG4gICAgICBERUZBVUxUID0gJ3sgfSc7XG5cbiAgICB2YXIgX3BhaXJzID0gW1xuICAgICAgJ3snLCAnfScsXG4gICAgICAneycsICd9JyxcbiAgICAgIC97W159XSp9LyxcbiAgICAgIC9cXFxcKFt7fV0pL2csXG4gICAgICAvXFxcXCh7KXx7L2csXG4gICAgICBSZWdFeHAoJ1xcXFxcXFxcKH0pfChbWyh7XSl8KH0pfCcgKyBTX1FCTE9DSzIsIFJFR0xPQiksXG4gICAgICBERUZBVUxULFxuICAgICAgL15cXHMqe1xcXj9cXHMqKFskXFx3XSspKD86XFxzKixcXHMqKFxcUyspKT9cXHMraW5cXHMrKFxcUy4qKVxccyp9LyxcbiAgICAgIC8oXnxbXlxcXFxdKXs9W1xcU1xcc10qP30vXG4gICAgXTtcblxuICAgIHZhclxuICAgICAgY2FjaGVkQnJhY2tldHMgPSBVTkRFRixcbiAgICAgIF9yZWdleCxcbiAgICAgIF9jYWNoZSA9IFtdLFxuICAgICAgX3NldHRpbmdzO1xuXG4gICAgZnVuY3Rpb24gX2xvb3BiYWNrIChyZSkgeyByZXR1cm4gcmUgfVxuXG4gICAgZnVuY3Rpb24gX3Jld3JpdGUgKHJlLCBicCkge1xuICAgICAgaWYgKCFicCkgeyBicCA9IF9jYWNoZTsgfVxuICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoXG4gICAgICAgIHJlLnNvdXJjZS5yZXBsYWNlKC97L2csIGJwWzJdKS5yZXBsYWNlKC99L2csIGJwWzNdKSwgcmUuZ2xvYmFsID8gUkVHTE9CIDogJydcbiAgICAgIClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY3JlYXRlIChwYWlyKSB7XG4gICAgICBpZiAocGFpciA9PT0gREVGQVVMVCkgeyByZXR1cm4gX3BhaXJzIH1cblxuICAgICAgdmFyIGFyciA9IHBhaXIuc3BsaXQoJyAnKTtcblxuICAgICAgaWYgKGFyci5sZW5ndGggIT09IDIgfHwgVU5TVVBQT1JURUQudGVzdChwYWlyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIGJyYWNrZXRzIFwiJyArIHBhaXIgKyAnXCInKVxuICAgICAgfVxuICAgICAgYXJyID0gYXJyLmNvbmNhdChwYWlyLnJlcGxhY2UoTkVFRF9FU0NBUEUsICdcXFxcJykuc3BsaXQoJyAnKSk7XG5cbiAgICAgIGFycls0XSA9IF9yZXdyaXRlKGFyclsxXS5sZW5ndGggPiAxID8gL3tbXFxTXFxzXSo/fS8gOiBfcGFpcnNbNF0sIGFycik7XG4gICAgICBhcnJbNV0gPSBfcmV3cml0ZShwYWlyLmxlbmd0aCA+IDMgPyAvXFxcXCh7fH0pL2cgOiBfcGFpcnNbNV0sIGFycik7XG4gICAgICBhcnJbNl0gPSBfcmV3cml0ZShfcGFpcnNbNl0sIGFycik7XG4gICAgICBhcnJbN10gPSBSZWdFeHAoJ1xcXFxcXFxcKCcgKyBhcnJbM10gKyAnKXwoW1soe10pfCgnICsgYXJyWzNdICsgJyl8JyArIFNfUUJMT0NLMiwgUkVHTE9CKTtcbiAgICAgIGFycls4XSA9IHBhaXI7XG4gICAgICByZXR1cm4gYXJyXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2JyYWNrZXRzIChyZU9ySWR4KSB7XG4gICAgICByZXR1cm4gcmVPcklkeCBpbnN0YW5jZW9mIFJlZ0V4cCA/IF9yZWdleChyZU9ySWR4KSA6IF9jYWNoZVtyZU9ySWR4XVxuICAgIH1cblxuICAgIF9icmFja2V0cy5zcGxpdCA9IGZ1bmN0aW9uIHNwbGl0IChzdHIsIHRtcGwsIF9icCkge1xuICAgICAgLy8gaXN0YW5idWwgaWdub3JlIG5leHQ6IF9icCBpcyBmb3IgdGhlIGNvbXBpbGVyXG4gICAgICBpZiAoIV9icCkgeyBfYnAgPSBfY2FjaGU7IH1cblxuICAgICAgdmFyXG4gICAgICAgIHBhcnRzID0gW10sXG4gICAgICAgIG1hdGNoLFxuICAgICAgICBpc2V4cHIsXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBwb3MsXG4gICAgICAgIHJlID0gX2JwWzZdO1xuXG4gICAgICB2YXIgcWJsb2NrcyA9IFtdO1xuICAgICAgdmFyIHByZXZTdHIgPSAnJztcbiAgICAgIHZhciBtYXJrLCBsYXN0SW5kZXg7XG5cbiAgICAgIGlzZXhwciA9IHN0YXJ0ID0gcmUubGFzdEluZGV4ID0gMDtcblxuICAgICAgd2hpbGUgKChtYXRjaCA9IHJlLmV4ZWMoc3RyKSkpIHtcblxuICAgICAgICBsYXN0SW5kZXggPSByZS5sYXN0SW5kZXg7XG4gICAgICAgIHBvcyA9IG1hdGNoLmluZGV4O1xuXG4gICAgICAgIGlmIChpc2V4cHIpIHtcblxuICAgICAgICAgIGlmIChtYXRjaFsyXSkge1xuXG4gICAgICAgICAgICB2YXIgY2ggPSBtYXRjaFsyXTtcbiAgICAgICAgICAgIHZhciByZWNoID0gRklOREJSQUNFU1tjaF07XG4gICAgICAgICAgICB2YXIgaXggPSAxO1xuXG4gICAgICAgICAgICByZWNoLmxhc3RJbmRleCA9IGxhc3RJbmRleDtcbiAgICAgICAgICAgIHdoaWxlICgobWF0Y2ggPSByZWNoLmV4ZWMoc3RyKSkpIHtcbiAgICAgICAgICAgICAgaWYgKG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoWzFdID09PSBjaCkgeyArK2l4OyB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoIS0taXgpIHsgYnJlYWsgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlY2gubGFzdEluZGV4ID0gcHVzaFFCbG9jayhtYXRjaC5pbmRleCwgcmVjaC5sYXN0SW5kZXgsIG1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmUubGFzdEluZGV4ID0gaXggPyBzdHIubGVuZ3RoIDogcmVjaC5sYXN0SW5kZXg7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghbWF0Y2hbM10pIHtcbiAgICAgICAgICAgIHJlLmxhc3RJbmRleCA9IHB1c2hRQmxvY2socG9zLCBsYXN0SW5kZXgsIG1hdGNoWzRdKTtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtYXRjaFsxXSkge1xuICAgICAgICAgIHVuZXNjYXBlU3RyKHN0ci5zbGljZShzdGFydCwgcG9zKSk7XG4gICAgICAgICAgc3RhcnQgPSByZS5sYXN0SW5kZXg7XG4gICAgICAgICAgcmUgPSBfYnBbNiArIChpc2V4cHIgXj0gMSldO1xuICAgICAgICAgIHJlLmxhc3RJbmRleCA9IHN0YXJ0O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzdHIgJiYgc3RhcnQgPCBzdHIubGVuZ3RoKSB7XG4gICAgICAgIHVuZXNjYXBlU3RyKHN0ci5zbGljZShzdGFydCkpO1xuICAgICAgfVxuXG4gICAgICBwYXJ0cy5xYmxvY2tzID0gcWJsb2NrcztcblxuICAgICAgcmV0dXJuIHBhcnRzXG5cbiAgICAgIGZ1bmN0aW9uIHVuZXNjYXBlU3RyIChzKSB7XG4gICAgICAgIGlmIChwcmV2U3RyKSB7XG4gICAgICAgICAgcyA9IHByZXZTdHIgKyBzO1xuICAgICAgICAgIHByZXZTdHIgPSAnJztcbiAgICAgICAgfVxuICAgICAgICBpZiAodG1wbCB8fCBpc2V4cHIpIHtcbiAgICAgICAgICBwYXJ0cy5wdXNoKHMgJiYgcy5yZXBsYWNlKF9icFs1XSwgJyQxJykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhcnRzLnB1c2gocyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gcHVzaFFCbG9jayhfcG9zLCBfbGFzdEluZGV4LCBzbGFzaCkgeyAvL2VzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgaWYgKHNsYXNoKSB7XG4gICAgICAgICAgX2xhc3RJbmRleCA9IHNraXBSZWdleChzdHIsIF9wb3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRtcGwgJiYgX2xhc3RJbmRleCA+IF9wb3MgKyAyKSB7XG4gICAgICAgICAgbWFyayA9ICdcXHUyMDU3JyArIHFibG9ja3MubGVuZ3RoICsgJ34nO1xuICAgICAgICAgIHFibG9ja3MucHVzaChzdHIuc2xpY2UoX3BvcywgX2xhc3RJbmRleCkpO1xuICAgICAgICAgIHByZXZTdHIgKz0gc3RyLnNsaWNlKHN0YXJ0LCBfcG9zKSArIG1hcms7XG4gICAgICAgICAgc3RhcnQgPSBfbGFzdEluZGV4O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfbGFzdEluZGV4XG4gICAgICB9XG4gICAgfTtcblxuICAgIF9icmFja2V0cy5oYXNFeHByID0gZnVuY3Rpb24gaGFzRXhwciAoc3RyKSB7XG4gICAgICByZXR1cm4gX2NhY2hlWzRdLnRlc3Qoc3RyKVxuICAgIH07XG5cbiAgICBfYnJhY2tldHMubG9vcEtleXMgPSBmdW5jdGlvbiBsb29wS2V5cyAoZXhwcikge1xuICAgICAgdmFyIG0gPSBleHByLm1hdGNoKF9jYWNoZVs5XSk7XG5cbiAgICAgIHJldHVybiBtXG4gICAgICAgID8geyBrZXk6IG1bMV0sIHBvczogbVsyXSwgdmFsOiBfY2FjaGVbMF0gKyBtWzNdLnRyaW0oKSArIF9jYWNoZVsxXSB9XG4gICAgICAgIDogeyB2YWw6IGV4cHIudHJpbSgpIH1cbiAgICB9O1xuXG4gICAgX2JyYWNrZXRzLmFycmF5ID0gZnVuY3Rpb24gYXJyYXkgKHBhaXIpIHtcbiAgICAgIHJldHVybiBwYWlyID8gX2NyZWF0ZShwYWlyKSA6IF9jYWNoZVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBfcmVzZXQgKHBhaXIpIHtcbiAgICAgIGlmICgocGFpciB8fCAocGFpciA9IERFRkFVTFQpKSAhPT0gX2NhY2hlWzhdKSB7XG4gICAgICAgIF9jYWNoZSA9IF9jcmVhdGUocGFpcik7XG4gICAgICAgIF9yZWdleCA9IHBhaXIgPT09IERFRkFVTFQgPyBfbG9vcGJhY2sgOiBfcmV3cml0ZTtcbiAgICAgICAgX2NhY2hlWzldID0gX3JlZ2V4KF9wYWlyc1s5XSk7XG4gICAgICB9XG4gICAgICBjYWNoZWRCcmFja2V0cyA9IHBhaXI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3NldFNldHRpbmdzIChvKSB7XG4gICAgICB2YXIgYjtcblxuICAgICAgbyA9IG8gfHwge307XG4gICAgICBiID0gby5icmFja2V0cztcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCAnYnJhY2tldHMnLCB7XG4gICAgICAgIHNldDogX3Jlc2V0LFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIGNhY2hlZEJyYWNrZXRzIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgX3NldHRpbmdzID0gbztcbiAgICAgIF9yZXNldChiKTtcbiAgICB9XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX2JyYWNrZXRzLCAnc2V0dGluZ3MnLCB7XG4gICAgICBzZXQ6IF9zZXRTZXR0aW5ncyxcbiAgICAgIGdldDogZnVuY3Rpb24gKCkgeyByZXR1cm4gX3NldHRpbmdzIH1cbiAgICB9KTtcblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0OiBpbiB0aGUgYnJvd3NlciByaW90IGlzIGFsd2F5cyBpbiB0aGUgc2NvcGUgKi9cbiAgICBfYnJhY2tldHMuc2V0dGluZ3MgPSB0eXBlb2YgcmlvdCAhPT0gJ3VuZGVmaW5lZCcgJiYgcmlvdC5zZXR0aW5ncyB8fCB7fTtcbiAgICBfYnJhY2tldHMuc2V0ID0gX3Jlc2V0O1xuICAgIF9icmFja2V0cy5za2lwUmVnZXggPSBza2lwUmVnZXg7XG5cbiAgICBfYnJhY2tldHMuUl9TVFJJTkdTID0gUl9TVFJJTkdTO1xuICAgIF9icmFja2V0cy5SX01MQ09NTVMgPSBSX01MQ09NTVM7XG4gICAgX2JyYWNrZXRzLlNfUUJMT0NLUyA9IFNfUUJMT0NLUztcbiAgICBfYnJhY2tldHMuU19RQkxPQ0syID0gU19RQkxPQ0syO1xuXG4gICAgcmV0dXJuIF9icmFja2V0c1xuXG4gIH0pKCk7XG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgdG1wbFxuICAgKlxuICAgKiB0bXBsICAgICAgICAgIC0gUm9vdCBmdW5jdGlvbiwgcmV0dXJucyB0aGUgdGVtcGxhdGUgdmFsdWUsIHJlbmRlciB3aXRoIGRhdGFcbiAgICogdG1wbC5oYXNFeHByICAtIFRlc3QgdGhlIGV4aXN0ZW5jZSBvZiBhIGV4cHJlc3Npb24gaW5zaWRlIGEgc3RyaW5nXG4gICAqIHRtcGwubG9vcEtleXMgLSBHZXQgdGhlIGtleXMgZm9yIGFuICdlYWNoJyBsb29wICh1c2VkIGJ5IGBfZWFjaGApXG4gICAqL1xuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIHZhciB0bXBsID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBfY2FjaGUgPSB7fTtcblxuICAgIGZ1bmN0aW9uIF90bXBsIChzdHIsIGRhdGEpIHtcbiAgICAgIGlmICghc3RyKSB7IHJldHVybiBzdHIgfVxuXG4gICAgICByZXR1cm4gKF9jYWNoZVtzdHJdIHx8IChfY2FjaGVbc3RyXSA9IF9jcmVhdGUoc3RyKSkpLmNhbGwoXG4gICAgICAgIGRhdGEsIF9sb2dFcnIuYmluZCh7XG4gICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICB0bXBsOiBzdHJcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICB9XG5cbiAgICBfdG1wbC5oYXNFeHByID0gYnJhY2tldHMuaGFzRXhwcjtcblxuICAgIF90bXBsLmxvb3BLZXlzID0gYnJhY2tldHMubG9vcEtleXM7XG5cbiAgICAvLyBpc3RhbmJ1bCBpZ25vcmUgbmV4dFxuICAgIF90bXBsLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiAoKSB7IF9jYWNoZSA9IHt9OyB9O1xuXG4gICAgX3RtcGwuZXJyb3JIYW5kbGVyID0gbnVsbDtcblxuICAgIGZ1bmN0aW9uIF9sb2dFcnIgKGVyciwgY3R4KSB7XG5cbiAgICAgIGVyci5yaW90RGF0YSA9IHtcbiAgICAgICAgdGFnTmFtZTogY3R4ICYmIGN0eC5fXyAmJiBjdHguX18udGFnTmFtZSxcbiAgICAgICAgX3Jpb3RfaWQ6IGN0eCAmJiBjdHguX3Jpb3RfaWQgIC8vZXNsaW50LWRpc2FibGUtbGluZSBjYW1lbGNhc2VcbiAgICAgIH07XG5cbiAgICAgIGlmIChfdG1wbC5lcnJvckhhbmRsZXIpIHsgX3RtcGwuZXJyb3JIYW5kbGVyKGVycik7IH1cbiAgICAgIGVsc2UgaWYgKFxuICAgICAgICB0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgdHlwZW9mIGNvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbidcbiAgICAgICkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgY29uc29sZS5sb2coJzwlcz4gJXMnLCBlcnIucmlvdERhdGEudGFnTmFtZSB8fCAnVW5rbm93biB0YWcnLCB0aGlzLnRtcGwpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMuZGF0YSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY3JlYXRlIChzdHIpIHtcbiAgICAgIHZhciBleHByID0gX2dldFRtcGwoc3RyKTtcblxuICAgICAgaWYgKGV4cHIuc2xpY2UoMCwgMTEpICE9PSAndHJ5e3JldHVybiAnKSB7IGV4cHIgPSAncmV0dXJuICcgKyBleHByOyB9XG5cbiAgICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ0UnLCBleHByICsgJzsnKSAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgfVxuXG4gICAgdmFyIFJFX0RRVU9URSA9IC9cXHUyMDU3L2c7XG4gICAgdmFyIFJFX1FCTUFSSyA9IC9cXHUyMDU3KFxcZCspfi9nO1xuXG4gICAgZnVuY3Rpb24gX2dldFRtcGwgKHN0cikge1xuICAgICAgdmFyIHBhcnRzID0gYnJhY2tldHMuc3BsaXQoc3RyLnJlcGxhY2UoUkVfRFFVT1RFLCAnXCInKSwgMSk7XG4gICAgICB2YXIgcXN0ciA9IHBhcnRzLnFibG9ja3M7XG4gICAgICB2YXIgZXhwcjtcblxuICAgICAgaWYgKHBhcnRzLmxlbmd0aCA+IDIgfHwgcGFydHNbMF0pIHtcbiAgICAgICAgdmFyIGksIGosIGxpc3QgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSBqID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG5cbiAgICAgICAgICBleHByID0gcGFydHNbaV07XG5cbiAgICAgICAgICBpZiAoZXhwciAmJiAoZXhwciA9IGkgJiAxXG5cbiAgICAgICAgICAgICAgPyBfcGFyc2VFeHByKGV4cHIsIDEsIHFzdHIpXG5cbiAgICAgICAgICAgICAgOiAnXCInICsgZXhwclxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFwvZywgJ1xcXFxcXFxcJylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXHJcXG4/fFxcbi9nLCAnXFxcXG4nKVxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKSArXG4gICAgICAgICAgICAgICAgJ1wiJ1xuXG4gICAgICAgICAgICApKSB7IGxpc3RbaisrXSA9IGV4cHI7IH1cblxuICAgICAgICB9XG5cbiAgICAgICAgZXhwciA9IGogPCAyID8gbGlzdFswXVxuICAgICAgICAgICAgIDogJ1snICsgbGlzdC5qb2luKCcsJykgKyAnXS5qb2luKFwiXCIpJztcblxuICAgICAgfSBlbHNlIHtcblxuICAgICAgICBleHByID0gX3BhcnNlRXhwcihwYXJ0c1sxXSwgMCwgcXN0cik7XG4gICAgICB9XG5cbiAgICAgIGlmIChxc3RyLmxlbmd0aCkge1xuICAgICAgICBleHByID0gZXhwci5yZXBsYWNlKFJFX1FCTUFSSywgZnVuY3Rpb24gKF8sIHBvcykge1xuICAgICAgICAgIHJldHVybiBxc3RyW3Bvc11cbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHIvZywgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZXhwclxuICAgIH1cblxuICAgIHZhciBSRV9DU05BTUUgPSAvXig/OigtP1tfQS1aYS16XFx4QTAtXFx4RkZdWy1cXHdcXHhBMC1cXHhGRl0qKXxcXHUyMDU3KFxcZCspfik6LztcbiAgICB2YXJcbiAgICAgIFJFX0JSRU5EID0ge1xuICAgICAgICAnKCc6IC9bKCldL2csXG4gICAgICAgICdbJzogL1tbXFxdXS9nLFxuICAgICAgICAneyc6IC9be31dL2dcbiAgICAgIH07XG5cbiAgICBmdW5jdGlvbiBfcGFyc2VFeHByIChleHByLCBhc1RleHQsIHFzdHIpIHtcblxuICAgICAgZXhwciA9IGV4cHJcbiAgICAgICAgLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKClcbiAgICAgICAgLnJlcGxhY2UoL1xcID8oW1tcXCh7fSw/XFwuOl0pXFwgPy9nLCAnJDEnKTtcblxuICAgICAgaWYgKGV4cHIpIHtcbiAgICAgICAgdmFyXG4gICAgICAgICAgbGlzdCA9IFtdLFxuICAgICAgICAgIGNudCA9IDAsXG4gICAgICAgICAgbWF0Y2g7XG5cbiAgICAgICAgd2hpbGUgKGV4cHIgJiZcbiAgICAgICAgICAgICAgKG1hdGNoID0gZXhwci5tYXRjaChSRV9DU05BTUUpKSAmJlxuICAgICAgICAgICAgICAhbWF0Y2guaW5kZXhcbiAgICAgICAgICApIHtcbiAgICAgICAgICB2YXJcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGpzYixcbiAgICAgICAgICAgIHJlID0gLyx8KFtbeyhdKXwkL2c7XG5cbiAgICAgICAgICBleHByID0gUmVnRXhwLnJpZ2h0Q29udGV4dDtcbiAgICAgICAgICBrZXkgID0gbWF0Y2hbMl0gPyBxc3RyW21hdGNoWzJdXS5zbGljZSgxLCAtMSkudHJpbSgpLnJlcGxhY2UoL1xccysvZywgJyAnKSA6IG1hdGNoWzFdO1xuXG4gICAgICAgICAgd2hpbGUgKGpzYiA9IChtYXRjaCA9IHJlLmV4ZWMoZXhwcikpWzFdKSB7IHNraXBCcmFjZXMoanNiLCByZSk7IH1cblxuICAgICAgICAgIGpzYiAgPSBleHByLnNsaWNlKDAsIG1hdGNoLmluZGV4KTtcbiAgICAgICAgICBleHByID0gUmVnRXhwLnJpZ2h0Q29udGV4dDtcblxuICAgICAgICAgIGxpc3RbY250KytdID0gX3dyYXBFeHByKGpzYiwgMSwga2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cHIgPSAhY250ID8gX3dyYXBFeHByKGV4cHIsIGFzVGV4dClcbiAgICAgICAgICAgICA6IGNudCA+IDEgPyAnWycgKyBsaXN0LmpvaW4oJywnKSArICddLmpvaW4oXCIgXCIpLnRyaW0oKScgOiBsaXN0WzBdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGV4cHJcblxuICAgICAgZnVuY3Rpb24gc2tpcEJyYWNlcyAoY2gsIHJlKSB7XG4gICAgICAgIHZhclxuICAgICAgICAgIG1tLFxuICAgICAgICAgIGx2ID0gMSxcbiAgICAgICAgICBpciA9IFJFX0JSRU5EW2NoXTtcblxuICAgICAgICBpci5sYXN0SW5kZXggPSByZS5sYXN0SW5kZXg7XG4gICAgICAgIHdoaWxlIChtbSA9IGlyLmV4ZWMoZXhwcikpIHtcbiAgICAgICAgICBpZiAobW1bMF0gPT09IGNoKSB7ICsrbHY7IH1cbiAgICAgICAgICBlbHNlIGlmICghLS1sdikgeyBicmVhayB9XG4gICAgICAgIH1cbiAgICAgICAgcmUubGFzdEluZGV4ID0gbHYgPyBleHByLmxlbmd0aCA6IGlyLmxhc3RJbmRleDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpc3RhbmJ1bCBpZ25vcmUgbmV4dDogbm90IGJvdGhcbiAgICB2YXIgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cbiAgICAgIEpTX0NPTlRFWFQgPSAnXCJpbiB0aGlzP3RoaXM6JyArICh0eXBlb2Ygd2luZG93ICE9PSAnb2JqZWN0JyA/ICdnbG9iYWwnIDogJ3dpbmRvdycpICsgJykuJyxcbiAgICAgIEpTX1ZBUk5BTUUgPSAvWyx7XVtcXCRcXHddKyg/PTopfCheICp8W14kXFx3XFwue10pKD8hKD86dHlwZW9mfHRydWV8ZmFsc2V8bnVsbHx1bmRlZmluZWR8aW58aW5zdGFuY2VvZnxpcyg/OkZpbml0ZXxOYU4pfHZvaWR8TmFOfG5ld3xEYXRlfFJlZ0V4cHxNYXRoKSg/IVskXFx3XSkpKFskX0EtWmEtel1bJFxcd10qKS9nLFxuICAgICAgSlNfTk9QUk9QUyA9IC9eKD89KFxcLlskXFx3XSspKVxcMSg/OlteLlsoXXwkKS87XG5cbiAgICBmdW5jdGlvbiBfd3JhcEV4cHIgKGV4cHIsIGFzVGV4dCwga2V5KSB7XG4gICAgICB2YXIgdGI7XG5cbiAgICAgIGV4cHIgPSBleHByLnJlcGxhY2UoSlNfVkFSTkFNRSwgZnVuY3Rpb24gKG1hdGNoLCBwLCBtdmFyLCBwb3MsIHMpIHtcbiAgICAgICAgaWYgKG12YXIpIHtcbiAgICAgICAgICBwb3MgPSB0YiA/IDAgOiBwb3MgKyBtYXRjaC5sZW5ndGg7XG5cbiAgICAgICAgICBpZiAobXZhciAhPT0gJ3RoaXMnICYmIG12YXIgIT09ICdnbG9iYWwnICYmIG12YXIgIT09ICd3aW5kb3cnKSB7XG4gICAgICAgICAgICBtYXRjaCA9IHAgKyAnKFwiJyArIG12YXIgKyBKU19DT05URVhUICsgbXZhcjtcbiAgICAgICAgICAgIGlmIChwb3MpIHsgdGIgPSAocyA9IHNbcG9zXSkgPT09ICcuJyB8fCBzID09PSAnKCcgfHwgcyA9PT0gJ1snOyB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwb3MpIHtcbiAgICAgICAgICAgIHRiID0gIUpTX05PUFJPUFMudGVzdChzLnNsaWNlKHBvcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF0Y2hcbiAgICAgIH0pO1xuXG4gICAgICBpZiAodGIpIHtcbiAgICAgICAgZXhwciA9ICd0cnl7cmV0dXJuICcgKyBleHByICsgJ31jYXRjaChlKXtFKGUsdGhpcyl9JztcbiAgICAgIH1cblxuICAgICAgaWYgKGtleSkge1xuXG4gICAgICAgIGV4cHIgPSAodGJcbiAgICAgICAgICAgID8gJ2Z1bmN0aW9uKCl7JyArIGV4cHIgKyAnfS5jYWxsKHRoaXMpJyA6ICcoJyArIGV4cHIgKyAnKSdcbiAgICAgICAgICApICsgJz9cIicgKyBrZXkgKyAnXCI6XCJcIic7XG5cbiAgICAgIH0gZWxzZSBpZiAoYXNUZXh0KSB7XG5cbiAgICAgICAgZXhwciA9ICdmdW5jdGlvbih2KXsnICsgKHRiXG4gICAgICAgICAgICA/IGV4cHIucmVwbGFjZSgncmV0dXJuICcsICd2PScpIDogJ3Y9KCcgKyBleHByICsgJyknXG4gICAgICAgICAgKSArICc7cmV0dXJuIHZ8fHY9PT0wP3Y6XCJcIn0uY2FsbCh0aGlzKSc7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBleHByXG4gICAgfVxuXG4gICAgX3RtcGwudmVyc2lvbiA9IGJyYWNrZXRzLnZlcnNpb24gPSAndjMuMC44JztcblxuICAgIHJldHVybiBfdG1wbFxuXG4gIH0pKCk7XG5cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgdmFyIG9ic2VydmFibGUgPSBmdW5jdGlvbihlbCkge1xuXG4gICAgLyoqXG4gICAgICogRXh0ZW5kIHRoZSBvcmlnaW5hbCBvYmplY3Qgb3IgY3JlYXRlIGEgbmV3IGVtcHR5IG9uZVxuICAgICAqIEB0eXBlIHsgT2JqZWN0IH1cbiAgICAgKi9cblxuICAgIGVsID0gZWwgfHwge307XG5cbiAgICAvKipcbiAgICAgKiBQcml2YXRlIHZhcmlhYmxlc1xuICAgICAqL1xuICAgIHZhciBjYWxsYmFja3MgPSB7fSxcbiAgICAgIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4gICAgLyoqXG4gICAgICogUHVibGljIEFwaVxuICAgICAqL1xuXG4gICAgLy8gZXh0ZW5kIHRoZSBlbCBvYmplY3QgYWRkaW5nIHRoZSBvYnNlcnZhYmxlIG1ldGhvZHNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhlbCwge1xuICAgICAgLyoqXG4gICAgICAgKiBMaXN0ZW4gdG8gdGhlIGdpdmVuIGBldmVudGAgYW5kc1xuICAgICAgICogZXhlY3V0ZSB0aGUgYGNhbGxiYWNrYCBlYWNoIHRpbWUgYW4gZXZlbnQgaXMgdHJpZ2dlcmVkLlxuICAgICAgICogQHBhcmFtICB7IFN0cmluZyB9IGV2ZW50IC0gZXZlbnQgaWRcbiAgICAgICAqIEBwYXJhbSAgeyBGdW5jdGlvbiB9IGZuIC0gY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgICAqIEByZXR1cm5zIHsgT2JqZWN0IH0gZWxcbiAgICAgICAqL1xuICAgICAgb246IHtcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uKGV2ZW50LCBmbikge1xuICAgICAgICAgIGlmICh0eXBlb2YgZm4gPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgICAgIHsgKGNhbGxiYWNrc1tldmVudF0gPSBjYWxsYmFja3NbZXZlbnRdIHx8IFtdKS5wdXNoKGZuKTsgfVxuICAgICAgICAgIHJldHVybiBlbFxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlXG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlbW92ZXMgdGhlIGdpdmVuIGBldmVudGAgbGlzdGVuZXJzXG4gICAgICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGV2ZW50IC0gZXZlbnQgaWRcbiAgICAgICAqIEBwYXJhbSAgIHsgRnVuY3Rpb24gfSBmbiAtIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IGVsXG4gICAgICAgKi9cbiAgICAgIG9mZjoge1xuICAgICAgICB2YWx1ZTogZnVuY3Rpb24oZXZlbnQsIGZuKSB7XG4gICAgICAgICAgaWYgKGV2ZW50ID09ICcqJyAmJiAhZm4pIHsgY2FsbGJhY2tzID0ge307IH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICB2YXIgYXJyID0gY2FsbGJhY2tzW2V2ZW50XTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGNiOyBjYiA9IGFyciAmJiBhcnJbaV07ICsraSkge1xuICAgICAgICAgICAgICAgIGlmIChjYiA9PSBmbikgeyBhcnIuc3BsaWNlKGktLSwgMSk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHsgZGVsZXRlIGNhbGxiYWNrc1tldmVudF07IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGVsXG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogTGlzdGVuIHRvIHRoZSBnaXZlbiBgZXZlbnRgIGFuZFxuICAgICAgICogZXhlY3V0ZSB0aGUgYGNhbGxiYWNrYCBhdCBtb3N0IG9uY2VcbiAgICAgICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gZXZlbnQgLSBldmVudCBpZFxuICAgICAgICogQHBhcmFtICAgeyBGdW5jdGlvbiB9IGZuIC0gY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgICAqIEByZXR1cm5zIHsgT2JqZWN0IH0gZWxcbiAgICAgICAqL1xuICAgICAgb25lOiB7XG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbihldmVudCwgZm4pIHtcbiAgICAgICAgICBmdW5jdGlvbiBvbigpIHtcbiAgICAgICAgICAgIGVsLm9mZihldmVudCwgb24pO1xuICAgICAgICAgICAgZm4uYXBwbHkoZWwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBlbC5vbihldmVudCwgb24pXG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogRXhlY3V0ZSBhbGwgY2FsbGJhY2sgZnVuY3Rpb25zIHRoYXQgbGlzdGVuIHRvXG4gICAgICAgKiB0aGUgZ2l2ZW4gYGV2ZW50YFxuICAgICAgICogQHBhcmFtICAgeyBTdHJpbmcgfSBldmVudCAtIGV2ZW50IGlkXG4gICAgICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IGVsXG4gICAgICAgKi9cbiAgICAgIHRyaWdnZXI6IHtcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgdmFyIGFyZ3VtZW50cyQxID0gYXJndW1lbnRzO1xuXG5cbiAgICAgICAgICAvLyBnZXR0aW5nIHRoZSBhcmd1bWVudHNcbiAgICAgICAgICB2YXIgYXJnbGVuID0gYXJndW1lbnRzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgICBhcmdzID0gbmV3IEFycmF5KGFyZ2xlbiksXG4gICAgICAgICAgICBmbnMsXG4gICAgICAgICAgICBmbixcbiAgICAgICAgICAgIGk7XG5cbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYXJnbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHMkMVtpICsgMV07IC8vIHNraXAgZmlyc3QgYXJndW1lbnRcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmbnMgPSBzbGljZS5jYWxsKGNhbGxiYWNrc1tldmVudF0gfHwgW10sIDApO1xuXG4gICAgICAgICAgZm9yIChpID0gMDsgZm4gPSBmbnNbaV07ICsraSkge1xuICAgICAgICAgICAgZm4uYXBwbHkoZWwsIGFyZ3MpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjYWxsYmFja3NbJyonXSAmJiBldmVudCAhPSAnKicpXG4gICAgICAgICAgICB7IGVsLnRyaWdnZXIuYXBwbHkoZWwsIFsnKicsIGV2ZW50XS5jb25jYXQoYXJncykpOyB9XG5cbiAgICAgICAgICByZXR1cm4gZWxcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGVsXG5cbiAgfTtcblxuICAvKipcbiAgICogU2hvcnQgYWxpYXMgZm9yIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JcbiAgICovXG4gIGZ1bmN0aW9uIGdldFByb3BEZXNjcmlwdG9yIChvLCBrKSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobywgaylcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBwYXNzZWQgYXJndW1lbnQgaXMgdW5kZWZpbmVkXG4gICAqIEBwYXJhbSAgIHsgKiB9IHZhbHVlIC1cbiAgICogQHJldHVybnMgeyBCb29sZWFuIH0gLVxuICAgKi9cbiAgZnVuY3Rpb24gaXNVbmRlZmluZWQodmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBUX1VOREVGXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgd2hldGhlciBvYmplY3QncyBwcm9wZXJ0eSBjb3VsZCBiZSBvdmVycmlkZGVuXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gIG9iaiAtIHNvdXJjZSBvYmplY3RcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSAga2V5IC0gb2JqZWN0IHByb3BlcnR5XG4gICAqIEByZXR1cm5zIHsgQm9vbGVhbiB9IHRydWUgaWYgd3JpdGFibGVcbiAgICovXG4gIGZ1bmN0aW9uIGlzV3JpdGFibGUob2JqLCBrZXkpIHtcbiAgICB2YXIgZGVzY3JpcHRvciA9IGdldFByb3BEZXNjcmlwdG9yKG9iaiwga2V5KTtcbiAgICByZXR1cm4gaXNVbmRlZmluZWQob2JqW2tleV0pIHx8IGRlc2NyaXB0b3IgJiYgZGVzY3JpcHRvci53cml0YWJsZVxuICB9XG5cbiAgLyoqXG4gICAqIEV4dGVuZCBhbnkgb2JqZWN0IHdpdGggb3RoZXIgcHJvcGVydGllc1xuICAgKiBAcGFyYW0gICB7IE9iamVjdCB9IHNyYyAtIHNvdXJjZSBvYmplY3RcbiAgICogQHJldHVybnMgeyBPYmplY3QgfSB0aGUgcmVzdWx0aW5nIGV4dGVuZGVkIG9iamVjdFxuICAgKlxuICAgKiB2YXIgb2JqID0geyBmb286ICdiYXonIH1cbiAgICogZXh0ZW5kKG9iaiwge2JhcjogJ2JhcicsIGZvbzogJ2Jhcid9KVxuICAgKiBjb25zb2xlLmxvZyhvYmopID0+IHtiYXI6ICdiYXInLCBmb286ICdiYXInfVxuICAgKlxuICAgKi9cbiAgZnVuY3Rpb24gZXh0ZW5kKHNyYykge1xuICAgIHZhciBvYmo7XG4gICAgdmFyIGkgPSAxO1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgIHZhciBsID0gYXJncy5sZW5ndGg7XG5cbiAgICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgICAgaWYgKG9iaiA9IGFyZ3NbaV0pIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHRoaXMgcHJvcGVydHkgb2YgdGhlIHNvdXJjZSBvYmplY3QgY291bGQgYmUgb3ZlcnJpZGRlblxuICAgICAgICAgIGlmIChpc1dyaXRhYmxlKHNyYywga2V5KSlcbiAgICAgICAgICAgIHsgc3JjW2tleV0gPSBvYmpba2V5XTsgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzcmNcbiAgfVxuXG4gIC8qKlxuICAgKiBBbGlhcyBmb3IgT2JqZWN0LmNyZWF0ZVxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlKHNyYykge1xuICAgIHJldHVybiBPYmplY3QuY3JlYXRlKHNyYylcbiAgfVxuXG4gIHZhciBzZXR0aW5ncyA9IGV4dGVuZChjcmVhdGUoYnJhY2tldHMuc2V0dGluZ3MpLCB7XG4gICAgc2tpcEFub255bW91c1RhZ3M6IHRydWUsXG4gICAgLy8gdGhlIFwidmFsdWVcIiBhdHRyaWJ1dGVzIHdpbGwgYmUgcHJlc2VydmVkXG4gICAga2VlcFZhbHVlQXR0cmlidXRlczogZmFsc2UsXG4gICAgLy8gaGFuZGxlIHRoZSBhdXRvIHVwZGF0ZXMgb24gYW55IERPTSBldmVudFxuICAgIGF1dG9VcGRhdGU6IHRydWVcbiAgfSk7XG5cbiAgLyoqXG4gICAqIFNob3J0ZXIgYW5kIGZhc3Qgd2F5IHRvIHNlbGVjdCBtdWx0aXBsZSBub2RlcyBpbiB0aGUgRE9NXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gc2VsZWN0b3IgLSBET00gc2VsZWN0b3JcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBjdHggLSBET00gbm9kZSB3aGVyZSB0aGUgdGFyZ2V0cyBvZiBvdXIgc2VhcmNoIHdpbGwgaXMgbG9jYXRlZFxuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IGRvbSBub2RlcyBmb3VuZFxuICAgKi9cbiAgZnVuY3Rpb24gJCQoc2VsZWN0b3IsIGN0eCkge1xuICAgIHJldHVybiBbXS5zbGljZS5jYWxsKChjdHggfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpKVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGRvY3VtZW50IHRleHQgbm9kZVxuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IGNyZWF0ZSBhIHRleHQgbm9kZSB0byB1c2UgYXMgcGxhY2Vob2xkZXJcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZURPTVBsYWNlaG9sZGVyKCkge1xuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJylcbiAgfVxuXG4gIC8qKlxuICAgKiBUb2dnbGUgdGhlIHZpc2liaWxpdHkgb2YgYW55IERPTSBub2RlXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gIGRvbSAtIERPTSBub2RlIHdlIHdhbnQgdG8gaGlkZVxuICAgKiBAcGFyYW0gICB7IEJvb2xlYW4gfSBzaG93IC0gZG8gd2Ugd2FudCB0byBzaG93IGl0P1xuICAgKi9cblxuICBmdW5jdGlvbiB0b2dnbGVWaXNpYmlsaXR5KGRvbSwgc2hvdykge1xuICAgIGRvbS5zdHlsZS5kaXNwbGF5ID0gc2hvdyA/ICcnIDogJ25vbmUnO1xuICAgIGRvbS5oaWRkZW4gPSBzaG93ID8gZmFsc2UgOiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgdmFsdWUgb2YgYW55IERPTSBhdHRyaWJ1dGUgb24gYSBub2RlXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZG9tIC0gRE9NIG5vZGUgd2Ugd2FudCB0byBwYXJzZVxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IG5hbWUgLSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGUgd2Ugd2FudCB0byBnZXRcbiAgICogQHJldHVybnMgeyBTdHJpbmcgfCB1bmRlZmluZWQgfSBuYW1lIG9mIHRoZSBub2RlIGF0dHJpYnV0ZSB3aGV0aGVyIGl0IGV4aXN0c1xuICAgKi9cbiAgZnVuY3Rpb24gZ2V0QXR0cmlidXRlKGRvbSwgbmFtZSkge1xuICAgIHJldHVybiBkb20uZ2V0QXR0cmlidXRlKG5hbWUpXG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFueSBET00gYXR0cmlidXRlIGZyb20gYSBub2RlXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZG9tIC0gRE9NIG5vZGUgd2Ugd2FudCB0byB1cGRhdGVcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSBuYW1lIC0gbmFtZSBvZiB0aGUgcHJvcGVydHkgd2Ugd2FudCB0byByZW1vdmVcbiAgICovXG4gIGZ1bmN0aW9uIHJlbW92ZUF0dHJpYnV0ZShkb20sIG5hbWUpIHtcbiAgICBkb20ucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgaW5uZXIgaHRtbCBvZiBhbnkgRE9NIG5vZGUgU1ZHcyBpbmNsdWRlZFxuICAgKiBAcGFyYW0geyBPYmplY3QgfSBjb250YWluZXIgLSBET00gbm9kZSB3aGVyZSB3ZSdsbCBpbmplY3QgbmV3IGh0bWxcbiAgICogQHBhcmFtIHsgU3RyaW5nIH0gaHRtbCAtIGh0bWwgdG8gaW5qZWN0XG4gICAqIEBwYXJhbSB7IEJvb2xlYW4gfSBpc1N2ZyAtIHN2ZyB0YWdzIHNob3VsZCBiZSB0cmVhdGVkIGEgYml0IGRpZmZlcmVudGx5XG4gICAqL1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBmdW5jdGlvbiBzZXRJbm5lckhUTUwoY29udGFpbmVyLCBodG1sLCBpc1N2Zykge1xuICAgIC8vIGlubmVySFRNTCBpcyBub3Qgc3VwcG9ydGVkIG9uIHN2ZyB0YWdzIHNvIHdlIG5lZXQgdG8gdHJlYXQgdGhlbSBkaWZmZXJlbnRseVxuICAgIGlmIChpc1N2Zykge1xuICAgICAgdmFyIG5vZGUgPSBjb250YWluZXIub3duZXJEb2N1bWVudC5pbXBvcnROb2RlKFxuICAgICAgICBuZXcgRE9NUGFyc2VyKClcbiAgICAgICAgICAucGFyc2VGcm9tU3RyaW5nKChcIjxzdmcgeG1sbnM9XFxcIlwiICsgU1ZHX05TICsgXCJcXFwiPlwiICsgaHRtbCArIFwiPC9zdmc+XCIpLCAnYXBwbGljYXRpb24veG1sJylcbiAgICAgICAgICAuZG9jdW1lbnRFbGVtZW50LFxuICAgICAgICB0cnVlXG4gICAgICApO1xuXG4gICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBodG1sO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNaW5pbWl6ZSByaXNrOiBvbmx5IHplcm8gb3Igb25lIF9zcGFjZV8gYmV0d2VlbiBhdHRyICYgdmFsdWVcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIGh0bWwgLSBodG1sIHN0cmluZyB3ZSB3YW50IHRvIHBhcnNlXG4gICAqIEBwYXJhbSAgIHsgRnVuY3Rpb24gfSBmbiAtIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGFwcGx5IG9uIGFueSBhdHRyaWJ1dGUgZm91bmRcbiAgICovXG4gIGZ1bmN0aW9uIHdhbGtBdHRyaWJ1dGVzKGh0bWwsIGZuKSB7XG4gICAgaWYgKCFodG1sKSB7IHJldHVybiB9XG4gICAgdmFyIG07XG4gICAgd2hpbGUgKG0gPSBSRV9IVE1MX0FUVFJTLmV4ZWMoaHRtbCkpXG4gICAgICB7IGZuKG1bMV0udG9Mb3dlckNhc2UoKSwgbVsyXSB8fCBtWzNdIHx8IG1bNF0pOyB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgZG9jdW1lbnQgZnJhZ21lbnRcbiAgICogQHJldHVybnMgeyBPYmplY3QgfSBkb2N1bWVudCBmcmFnbWVudFxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlRnJhZ21lbnQoKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKVxuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydCBzYWZlbHkgYSB0YWcgdG8gZml4ICMxOTYyICMxNjQ5XG4gICAqIEBwYXJhbSAgIHsgSFRNTEVsZW1lbnQgfSByb290IC0gY2hpbGRyZW4gY29udGFpbmVyXG4gICAqIEBwYXJhbSAgIHsgSFRNTEVsZW1lbnQgfSBjdXJyIC0gbm9kZSB0byBpbnNlcnRcbiAgICogQHBhcmFtICAgeyBIVE1MRWxlbWVudCB9IG5leHQgLSBub2RlIHRoYXQgc2hvdWxkIHByZWNlZWQgdGhlIGN1cnJlbnQgbm9kZSBpbnNlcnRlZFxuICAgKi9cbiAgZnVuY3Rpb24gc2FmZUluc2VydChyb290LCBjdXJyLCBuZXh0KSB7XG4gICAgcm9vdC5pbnNlcnRCZWZvcmUoY3VyciwgbmV4dC5wYXJlbnROb2RlICYmIG5leHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYSBzdHlsZSBvYmplY3QgdG8gYSBzdHJpbmdcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBzdHlsZSAtIHN0eWxlIG9iamVjdCB3ZSBuZWVkIHRvIHBhcnNlXG4gICAqIEByZXR1cm5zIHsgU3RyaW5nIH0gcmVzdWx0aW5nIGNzcyBzdHJpbmdcbiAgICogQGV4YW1wbGVcbiAgICogc3R5bGVPYmplY3RUb1N0cmluZyh7IGNvbG9yOiAncmVkJywgaGVpZ2h0OiAnMTBweCd9KSAvLyA9PiAnY29sb3I6IHJlZDsgaGVpZ2h0OiAxMHB4J1xuICAgKi9cbiAgZnVuY3Rpb24gc3R5bGVPYmplY3RUb1N0cmluZyhzdHlsZSkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzdHlsZSkucmVkdWNlKGZ1bmN0aW9uIChhY2MsIHByb3ApIHtcbiAgICAgIHJldHVybiAoYWNjICsgXCIgXCIgKyBwcm9wICsgXCI6IFwiICsgKHN0eWxlW3Byb3BdKSArIFwiO1wiKVxuICAgIH0sICcnKVxuICB9XG5cbiAgLyoqXG4gICAqIFdhbGsgZG93biByZWN1cnNpdmVseSBhbGwgdGhlIGNoaWxkcmVuIHRhZ3Mgc3RhcnRpbmcgZG9tIG5vZGVcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSAgIGRvbSAtIHN0YXJ0aW5nIG5vZGUgd2hlcmUgd2Ugd2lsbCBzdGFydCB0aGUgcmVjdXJzaW9uXG4gICAqIEBwYXJhbSAgIHsgRnVuY3Rpb24gfSBmbiAtIGNhbGxiYWNrIHRvIHRyYW5zZm9ybSB0aGUgY2hpbGQgbm9kZSBqdXN0IGZvdW5kXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gICBjb250ZXh0IC0gZm4gY2FuIG9wdGlvbmFsbHkgcmV0dXJuIGFuIG9iamVjdCwgd2hpY2ggaXMgcGFzc2VkIHRvIGNoaWxkcmVuXG4gICAqL1xuICBmdW5jdGlvbiB3YWxrTm9kZXMoZG9tLCBmbiwgY29udGV4dCkge1xuICAgIGlmIChkb20pIHtcbiAgICAgIHZhciByZXMgPSBmbihkb20sIGNvbnRleHQpO1xuICAgICAgdmFyIG5leHQ7XG4gICAgICAvLyBzdG9wIHRoZSByZWN1cnNpb25cbiAgICAgIGlmIChyZXMgPT09IGZhbHNlKSB7IHJldHVybiB9XG5cbiAgICAgIGRvbSA9IGRvbS5maXJzdENoaWxkO1xuXG4gICAgICB3aGlsZSAoZG9tKSB7XG4gICAgICAgIG5leHQgPSBkb20ubmV4dFNpYmxpbmc7XG4gICAgICAgIHdhbGtOb2Rlcyhkb20sIGZuLCByZXMpO1xuICAgICAgICBkb20gPSBuZXh0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cblxuICB2YXIgZG9tID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuICAgICQkOiAkJCxcbiAgICAkOiAkLFxuICAgIGNyZWF0ZURPTVBsYWNlaG9sZGVyOiBjcmVhdGVET01QbGFjZWhvbGRlcixcbiAgICBta0VsOiBtYWtlRWxlbWVudCxcbiAgICBzZXRBdHRyOiBzZXRBdHRyaWJ1dGUsXG4gICAgdG9nZ2xlVmlzaWJpbGl0eTogdG9nZ2xlVmlzaWJpbGl0eSxcbiAgICBnZXRBdHRyOiBnZXRBdHRyaWJ1dGUsXG4gICAgcmVtQXR0cjogcmVtb3ZlQXR0cmlidXRlLFxuICAgIHNldElubmVySFRNTDogc2V0SW5uZXJIVE1MLFxuICAgIHdhbGtBdHRyczogd2Fsa0F0dHJpYnV0ZXMsXG4gICAgY3JlYXRlRnJhZzogY3JlYXRlRnJhZ21lbnQsXG4gICAgc2FmZUluc2VydDogc2FmZUluc2VydCxcbiAgICBzdHlsZU9iamVjdFRvU3RyaW5nOiBzdHlsZU9iamVjdFRvU3RyaW5nLFxuICAgIHdhbGtOb2Rlczogd2Fsa05vZGVzXG4gIH0pO1xuXG4gIC8qKlxuICAgKiBDaGVjayBhZ2FpbnN0IHRoZSBudWxsIGFuZCB1bmRlZmluZWQgdmFsdWVzXG4gICAqIEBwYXJhbSAgIHsgKiB9ICB2YWx1ZSAtXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSAtXG4gICAqL1xuICBmdW5jdGlvbiBpc05pbCh2YWx1ZSkge1xuICAgIHJldHVybiBpc1VuZGVmaW5lZCh2YWx1ZSkgfHwgdmFsdWUgPT09IG51bGxcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBwYXNzZWQgYXJndW1lbnQgaXMgZW1wdHkuIERpZmZlcmVudCBmcm9tIGZhbHN5LCBiZWNhdXNlIHdlIGRvbnQgY29uc2lkZXIgMCBvciBmYWxzZSB0byBiZSBibGFua1xuICAgKiBAcGFyYW0geyAqIH0gdmFsdWUgLVxuICAgKiBAcmV0dXJucyB7IEJvb2xlYW4gfSAtXG4gICAqL1xuICBmdW5jdGlvbiBpc0JsYW5rKHZhbHVlKSB7XG4gICAgcmV0dXJuIGlzTmlsKHZhbHVlKSB8fCB2YWx1ZSA9PT0gJydcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBwYXNzZWQgYXJndW1lbnQgaXMgYSBmdW5jdGlvblxuICAgKiBAcGFyYW0gICB7ICogfSB2YWx1ZSAtXG4gICAqIEByZXR1cm5zIHsgQm9vbGVhbiB9IC1cbiAgICovXG4gIGZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBUX0ZVTkNUSU9OXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgcGFzc2VkIGFyZ3VtZW50IGlzIGFuIG9iamVjdCwgZXhjbHVkZSBudWxsXG4gICAqIE5PVEU6IHVzZSBpc09iamVjdCh4KSAmJiAhaXNBcnJheSh4KSB0byBleGNsdWRlcyBhcnJheXMuXG4gICAqIEBwYXJhbSAgIHsgKiB9IHZhbHVlIC1cbiAgICogQHJldHVybnMgeyBCb29sZWFuIH0gLVxuICAgKi9cbiAgZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSBUX09CSkVDVCAvLyB0eXBlb2YgbnVsbCBpcyAnb2JqZWN0J1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIGEgRE9NIG5vZGUgaXMgYW4gc3ZnIHRhZyBvciBwYXJ0IG9mIGFuIHN2Z1xuICAgKiBAcGFyYW0gICB7IEhUTUxFbGVtZW50IH0gIGVsIC0gbm9kZSB3ZSB3YW50IHRvIHRlc3RcbiAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgaXQncyBhbiBzdmcgbm9kZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNTdmcoZWwpIHtcbiAgICB2YXIgb3duZXIgPSBlbC5vd25lclNWR0VsZW1lbnQ7XG4gICAgcmV0dXJuICEhb3duZXIgfHwgb3duZXIgPT09IG51bGxcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBwYXNzZWQgYXJndW1lbnQgaXMgYSBraW5kIG9mIGFycmF5XG4gICAqIEBwYXJhbSAgIHsgKiB9IHZhbHVlIC1cbiAgICogQHJldHVybnMgeyBCb29sZWFuIH0gLVxuICAgKi9cbiAgZnVuY3Rpb24gaXNBcnJheSh2YWx1ZSkge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKSB8fCB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIHBhc3NlZCBhcmd1bWVudCBpcyBhIGJvb2xlYW4gYXR0cmlidXRlXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gdmFsdWUgLVxuICAgKiBAcmV0dXJucyB7IEJvb2xlYW4gfSAtXG4gICAqL1xuICBmdW5jdGlvbiBpc0Jvb2xBdHRyKHZhbHVlKSB7XG4gICAgcmV0dXJuIFJFX0JPT0xfQVRUUlMudGVzdCh2YWx1ZSlcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBwYXNzZWQgYXJndW1lbnQgaXMgYSBzdHJpbmdcbiAgICogQHBhcmFtICAgeyAqIH0gdmFsdWUgLVxuICAgKiBAcmV0dXJucyB7IEJvb2xlYW4gfSAtXG4gICAqL1xuICBmdW5jdGlvbiBpc1N0cmluZyh2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09IFRfU1RSSU5HXG4gIH1cblxuXG5cbiAgdmFyIGNoZWNrID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuICAgIGlzQmxhbms6IGlzQmxhbmssXG4gICAgaXNGdW5jdGlvbjogaXNGdW5jdGlvbixcbiAgICBpc09iamVjdDogaXNPYmplY3QsXG4gICAgaXNTdmc6IGlzU3ZnLFxuICAgIGlzV3JpdGFibGU6IGlzV3JpdGFibGUsXG4gICAgaXNBcnJheTogaXNBcnJheSxcbiAgICBpc0Jvb2xBdHRyOiBpc0Jvb2xBdHRyLFxuICAgIGlzTmlsOiBpc05pbCxcbiAgICBpc1N0cmluZzogaXNTdHJpbmcsXG4gICAgaXNVbmRlZmluZWQ6IGlzVW5kZWZpbmVkXG4gIH0pO1xuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIGFuIGFycmF5IGNvbnRhaW5zIGFuIGl0ZW1cbiAgICogQHBhcmFtICAgeyBBcnJheSB9IGFycmF5IC0gdGFyZ2V0IGFycmF5XG4gICAqIEBwYXJhbSAgIHsgKiB9IGl0ZW0gLSBpdGVtIHRvIHRlc3RcbiAgICogQHJldHVybnMgeyBCb29sZWFuIH0gLVxuICAgKi9cbiAgZnVuY3Rpb24gY29udGFpbnMoYXJyYXksIGl0ZW0pIHtcbiAgICByZXR1cm4gYXJyYXkuaW5kZXhPZihpdGVtKSAhPT0gLTFcbiAgfVxuXG4gIC8qKlxuICAgKiBTcGVjaWFsaXplZCBmdW5jdGlvbiBmb3IgbG9vcGluZyBhbiBhcnJheS1saWtlIGNvbGxlY3Rpb24gd2l0aCBgZWFjaD17fWBcbiAgICogQHBhcmFtICAgeyBBcnJheSB9IGxpc3QgLSBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAqIEBwYXJhbSAgIHtGdW5jdGlvbn0gZm4gLSBjYWxsYmFjayBmdW5jdGlvblxuICAgKiBAcmV0dXJucyB7IEFycmF5IH0gdGhlIGFycmF5IGxvb3BlZFxuICAgKi9cbiAgZnVuY3Rpb24gZWFjaChsaXN0LCBmbikge1xuICAgIHZhciBsZW4gPSBsaXN0ID8gbGlzdC5sZW5ndGggOiAwO1xuICAgIHZhciBpID0gMDtcbiAgICBmb3IgKDsgaSA8IGxlbjsgaSsrKSB7IGZuKGxpc3RbaV0sIGkpOyB9XG4gICAgcmV0dXJuIGxpc3RcbiAgfVxuXG4gIC8qKlxuICAgKiBGYXN0ZXIgU3RyaW5nIHN0YXJ0c1dpdGggYWx0ZXJuYXRpdmVcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSBzdHIgLSBzb3VyY2Ugc3RyaW5nXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gdmFsdWUgLSB0ZXN0IHN0cmluZ1xuICAgKiBAcmV0dXJucyB7IEJvb2xlYW4gfSAtXG4gICAqL1xuICBmdW5jdGlvbiBzdGFydHNXaXRoKHN0ciwgdmFsdWUpIHtcbiAgICByZXR1cm4gc3RyLnNsaWNlKDAsIHZhbHVlLmxlbmd0aCkgPT09IHZhbHVlXG4gIH1cblxuICAvKipcbiAgICogRnVuY3Rpb24gcmV0dXJuaW5nIGFsd2F5cyBhIHVuaXF1ZSBpZGVudGlmaWVyXG4gICAqIEByZXR1cm5zIHsgTnVtYmVyIH0gLSBudW1iZXIgZnJvbSAwLi4ublxuICAgKi9cbiAgdmFyIHVpZCA9IChmdW5jdGlvbiB1aWQoKSB7XG4gICAgdmFyIGkgPSAtMTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkgeyByZXR1cm4gKytpOyB9XG4gIH0pKCk7XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byBzZXQgYW4gaW1tdXRhYmxlIHByb3BlcnR5XG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZWwgLSBvYmplY3Qgd2hlcmUgdGhlIG5ldyBwcm9wZXJ0eSB3aWxsIGJlIHNldFxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGtleSAtIG9iamVjdCBrZXkgd2hlcmUgdGhlIG5ldyBwcm9wZXJ0eSB3aWxsIGJlIHN0b3JlZFxuICAgKiBAcGFyYW0gICB7ICogfSB2YWx1ZSAtIHZhbHVlIG9mIHRoZSBuZXcgcHJvcGVydHlcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBvcHRpb25zIC0gc2V0IHRoZSBwcm9wZXJ5IG92ZXJyaWRpbmcgdGhlIGRlZmF1bHQgb3B0aW9uc1xuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IC0gdGhlIGluaXRpYWwgb2JqZWN0XG4gICAqL1xuICBmdW5jdGlvbiBkZWZpbmUoZWwsIGtleSwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWwsIGtleSwgZXh0ZW5kKHtcbiAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSwgb3B0aW9ucykpO1xuICAgIHJldHVybiBlbFxuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYSBzdHJpbmcgY29udGFpbmluZyBkYXNoZXMgdG8gY2FtZWwgY2FzZVxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IHN0ciAtIGlucHV0IHN0cmluZ1xuICAgKiBAcmV0dXJucyB7IFN0cmluZyB9IG15LXN0cmluZyAtPiBteVN0cmluZ1xuICAgKi9cbiAgZnVuY3Rpb24gdG9DYW1lbChzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLy0oXFx3KS9nLCBmdW5jdGlvbiAoXywgYykgeyByZXR1cm4gYy50b1VwcGVyQ2FzZSgpOyB9KVxuICB9XG5cbiAgLyoqXG4gICAqIFdhcm4gYSBtZXNzYWdlIHZpYSBjb25zb2xlXG4gICAqIEBwYXJhbSAgIHtTdHJpbmd9IG1lc3NhZ2UgLSB3YXJuaW5nIG1lc3NhZ2VcbiAgICovXG4gIGZ1bmN0aW9uIHdhcm4obWVzc2FnZSkge1xuICAgIGlmIChjb25zb2xlICYmIGNvbnNvbGUud2FybikgeyBjb25zb2xlLndhcm4obWVzc2FnZSk7IH1cbiAgfVxuXG5cblxuICB2YXIgbWlzYyA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcbiAgICBjb250YWluczogY29udGFpbnMsXG4gICAgZWFjaDogZWFjaCxcbiAgICBnZXRQcm9wRGVzY3JpcHRvcjogZ2V0UHJvcERlc2NyaXB0b3IsXG4gICAgc3RhcnRzV2l0aDogc3RhcnRzV2l0aCxcbiAgICB1aWQ6IHVpZCxcbiAgICBkZWZpbmVQcm9wZXJ0eTogZGVmaW5lLFxuICAgIG9iamVjdENyZWF0ZTogY3JlYXRlLFxuICAgIGV4dGVuZDogZXh0ZW5kLFxuICAgIHRvQ2FtZWw6IHRvQ2FtZWwsXG4gICAgd2Fybjogd2FyblxuICB9KTtcblxuICAvKipcbiAgICogU2V0IHRoZSBwcm9wZXJ0eSBvZiBhbiBvYmplY3QgZm9yIGEgZ2l2ZW4ga2V5LiBJZiBzb21ldGhpbmcgYWxyZWFkeVxuICAgKiBleGlzdHMgdGhlcmUsIHRoZW4gaXQgYmVjb21lcyBhbiBhcnJheSBjb250YWluaW5nIGJvdGggdGhlIG9sZCBhbmQgbmV3IHZhbHVlLlxuICAgKiBAcGFyYW0geyBPYmplY3QgfSBvYmogLSBvYmplY3Qgb24gd2hpY2ggdG8gc2V0IHRoZSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0geyBTdHJpbmcgfSBrZXkgLSBwcm9wZXJ0eSBuYW1lXG4gICAqIEBwYXJhbSB7IE9iamVjdCB9IHZhbHVlIC0gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eSB0byBiZSBzZXRcbiAgICogQHBhcmFtIHsgQm9vbGVhbiB9IGVuc3VyZUFycmF5IC0gZW5zdXJlIHRoYXQgdGhlIHByb3BlcnR5IHJlbWFpbnMgYW4gYXJyYXlcbiAgICogQHBhcmFtIHsgTnVtYmVyIH0gaW5kZXggLSBhZGQgdGhlIG5ldyBpdGVtIGluIGEgY2VydGFpbiBhcnJheSBwb3NpdGlvblxuICAgKi9cbiAgZnVuY3Rpb24gYXJyYXlpc2hBZGQob2JqLCBrZXksIHZhbHVlLCBlbnN1cmVBcnJheSwgaW5kZXgpIHtcbiAgICB2YXIgZGVzdCA9IG9ialtrZXldO1xuICAgIHZhciBpc0FyciA9IGlzQXJyYXkoZGVzdCk7XG4gICAgdmFyIGhhc0luZGV4ID0gIWlzVW5kZWZpbmVkKGluZGV4KTtcblxuICAgIGlmIChkZXN0ICYmIGRlc3QgPT09IHZhbHVlKSB7IHJldHVybiB9XG5cbiAgICAvLyBpZiB0aGUga2V5IHdhcyBuZXZlciBzZXQsIHNldCBpdCBvbmNlXG4gICAgaWYgKCFkZXN0ICYmIGVuc3VyZUFycmF5KSB7IG9ialtrZXldID0gW3ZhbHVlXTsgfVxuICAgIGVsc2UgaWYgKCFkZXN0KSB7IG9ialtrZXldID0gdmFsdWU7IH1cbiAgICAvLyBpZiBpdCB3YXMgYW4gYXJyYXkgYW5kIG5vdCB5ZXQgc2V0XG4gICAgZWxzZSB7XG4gICAgICBpZiAoaXNBcnIpIHtcbiAgICAgICAgdmFyIG9sZEluZGV4ID0gZGVzdC5pbmRleE9mKHZhbHVlKTtcbiAgICAgICAgLy8gdGhpcyBpdGVtIG5ldmVyIGNoYW5nZWQgaXRzIHBvc2l0aW9uXG4gICAgICAgIGlmIChvbGRJbmRleCA9PT0gaW5kZXgpIHsgcmV0dXJuIH1cbiAgICAgICAgLy8gcmVtb3ZlIHRoZSBpdGVtIGZyb20gaXRzIG9sZCBwb3NpdGlvblxuICAgICAgICBpZiAob2xkSW5kZXggIT09IC0xKSB7IGRlc3Quc3BsaWNlKG9sZEluZGV4LCAxKTsgfVxuICAgICAgICAvLyBtb3ZlIG9yIGFkZCB0aGUgaXRlbVxuICAgICAgICBpZiAoaGFzSW5kZXgpIHtcbiAgICAgICAgICBkZXN0LnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlc3QucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7IG9ialtrZXldID0gW2Rlc3QsIHZhbHVlXTsgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlY3QgdGhlIHRhZyBpbXBsZW1lbnRhdGlvbiBieSBhIERPTSBub2RlXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZG9tIC0gRE9NIG5vZGUgd2UgbmVlZCB0byBwYXJzZSB0byBnZXQgaXRzIHRhZyBpbXBsZW1lbnRhdGlvblxuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IGl0IHJldHVybnMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGltcGxlbWVudGF0aW9uIG9mIGEgY3VzdG9tIHRhZyAodGVtcGxhdGUgYW5kIGJvb3QgZnVuY3Rpb24pXG4gICAqL1xuICBmdW5jdGlvbiBnZXQoZG9tKSB7XG4gICAgcmV0dXJuIGRvbS50YWdOYW1lICYmIF9fVEFHX0lNUExbZ2V0QXR0cmlidXRlKGRvbSwgSVNfRElSRUNUSVZFKSB8fFxuICAgICAgZ2V0QXR0cmlidXRlKGRvbSwgSVNfRElSRUNUSVZFKSB8fCBkb20udGFnTmFtZS50b0xvd2VyQ2FzZSgpXVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgdGFnIG5hbWUgb2YgYW55IERPTSBub2RlXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZG9tIC0gRE9NIG5vZGUgd2Ugd2FudCB0byBwYXJzZVxuICAgKiBAcGFyYW0gICB7IEJvb2xlYW4gfSBza2lwRGF0YUlzIC0gaGFjayB0byBpZ25vcmUgdGhlIGRhdGEtaXMgYXR0cmlidXRlIHdoZW4gYXR0YWNoaW5nIHRvIHBhcmVudFxuICAgKiBAcmV0dXJucyB7IFN0cmluZyB9IG5hbWUgdG8gaWRlbnRpZnkgdGhpcyBkb20gbm9kZSBpbiByaW90XG4gICAqL1xuICBmdW5jdGlvbiBnZXROYW1lKGRvbSwgc2tpcERhdGFJcykge1xuICAgIHZhciBjaGlsZCA9IGdldChkb20pO1xuICAgIHZhciBuYW1lZFRhZyA9ICFza2lwRGF0YUlzICYmIGdldEF0dHJpYnV0ZShkb20sIElTX0RJUkVDVElWRSk7XG4gICAgcmV0dXJuIG5hbWVkVGFnICYmICF0bXBsLmhhc0V4cHIobmFtZWRUYWcpID9cbiAgICAgIG5hbWVkVGFnIDogY2hpbGQgPyBjaGlsZC5uYW1lIDogZG9tLnRhZ05hbWUudG9Mb3dlckNhc2UoKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIHRlbXBvcmFyeSBjb250ZXh0IGNvbnRhaW5pbmcgYWxzbyB0aGUgcGFyZW50IHByb3BlcnRpZXNcbiAgICogQHRoaXMgVGFnXG4gICAqIEBwYXJhbSB7IFRhZyB9IC0gdGVtcG9yYXJ5IHRhZyBjb250ZXh0IGNvbnRhaW5pbmcgYWxsIHRoZSBwYXJlbnQgcHJvcGVydGllc1xuICAgKi9cbiAgZnVuY3Rpb24gaW5oZXJpdFBhcmVudFByb3BzKCkge1xuICAgIGlmICh0aGlzLnBhcmVudCkgeyByZXR1cm4gZXh0ZW5kKGNyZWF0ZSh0aGlzKSwgdGhpcy5wYXJlbnQpIH1cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLypcbiAgICBJbmNsdWRlcyBoYWNrcyBuZWVkZWQgZm9yIHRoZSBJbnRlcm5ldCBFeHBsb3JlciB2ZXJzaW9uIDkgYW5kIGJlbG93XG4gICAgU2VlOiBodHRwOi8va2FuZ2F4LmdpdGh1Yi5pby9jb21wYXQtdGFibGUvZXM1LyNpZThcbiAgICAgICAgIGh0dHA6Ly9jb2RlcGxhbmV0LmlvL2Ryb3BwaW5nLWllOC9cbiAgKi9cblxuICB2YXJcbiAgICByZUhhc1lpZWxkICA9IC88eWllbGRcXGIvaSxcbiAgICByZVlpZWxkQWxsICA9IC88eWllbGRcXHMqKD86XFwvPnw+KFtcXFNcXHNdKj8pPFxcL3lpZWxkXFxzKj58PikvaWcsXG4gICAgcmVZaWVsZFNyYyAgPSAvPHlpZWxkXFxzK3RvPVsnXCJdKFteJ1wiPl0qKVsnXCJdXFxzKj4oW1xcU1xcc10qPyk8XFwveWllbGRcXHMqPi9pZyxcbiAgICByZVlpZWxkRGVzdCA9IC88eWllbGRcXHMrZnJvbT1bJ1wiXT8oWy1cXHddKylbJ1wiXT9cXHMqKD86XFwvPnw+KFtcXFNcXHNdKj8pPFxcL3lpZWxkXFxzKj4pL2lnLFxuICAgIHJvb3RFbHMgPSB7IHRyOiAndGJvZHknLCB0aDogJ3RyJywgdGQ6ICd0cicsIGNvbDogJ2NvbGdyb3VwJyB9LFxuICAgIHRibFRhZ3MgPSBJRV9WRVJTSU9OICYmIElFX1ZFUlNJT04gPCAxMCA/IFJFX1NQRUNJQUxfVEFHUyA6IFJFX1NQRUNJQUxfVEFHU19OT19PUFRJT04sXG4gICAgR0VORVJJQyA9ICdkaXYnLFxuICAgIFNWRyA9ICdzdmcnO1xuXG5cbiAgLypcbiAgICBDcmVhdGVzIHRoZSByb290IGVsZW1lbnQgZm9yIHRhYmxlIG9yIHNlbGVjdCBjaGlsZCBlbGVtZW50czpcbiAgICB0ci90aC90ZC90aGVhZC90Zm9vdC90Ym9keS9jYXB0aW9uL2NvbC9jb2xncm91cC9vcHRpb24vb3B0Z3JvdXBcbiAgKi9cbiAgZnVuY3Rpb24gc3BlY2lhbFRhZ3MoZWwsIHRtcGwsIHRhZ05hbWUpIHtcblxuICAgIHZhclxuICAgICAgc2VsZWN0ID0gdGFnTmFtZVswXSA9PT0gJ28nLFxuICAgICAgcGFyZW50ID0gc2VsZWN0ID8gJ3NlbGVjdD4nIDogJ3RhYmxlPic7XG5cbiAgICAvLyB0cmltKCkgaXMgaW1wb3J0YW50IGhlcmUsIHRoaXMgZW5zdXJlcyB3ZSBkb24ndCBoYXZlIGFydGlmYWN0cyxcbiAgICAvLyBzbyB3ZSBjYW4gY2hlY2sgaWYgd2UgaGF2ZSBvbmx5IG9uZSBlbGVtZW50IGluc2lkZSB0aGUgcGFyZW50XG4gICAgZWwuaW5uZXJIVE1MID0gJzwnICsgcGFyZW50ICsgdG1wbC50cmltKCkgKyAnPC8nICsgcGFyZW50O1xuICAgIHBhcmVudCA9IGVsLmZpcnN0Q2hpbGQ7XG5cbiAgICAvLyByZXR1cm5zIHRoZSBpbW1lZGlhdGUgcGFyZW50IGlmIHRyL3RoL3RkL2NvbCBpcyB0aGUgb25seSBlbGVtZW50LCBpZiBub3RcbiAgICAvLyByZXR1cm5zIHRoZSB3aG9sZSB0cmVlLCBhcyB0aGlzIGNhbiBpbmNsdWRlIGFkZGl0aW9uYWwgZWxlbWVudHNcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmIChzZWxlY3QpIHtcbiAgICAgIHBhcmVudC5zZWxlY3RlZEluZGV4ID0gLTE7ICAvLyBmb3IgSUU5LCBjb21wYXRpYmxlIHcvY3VycmVudCByaW90IGJlaGF2aW9yXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGF2b2lkcyBpbnNlcnRpb24gb2YgY29pbnRhaW5lciBpbnNpZGUgY29udGFpbmVyIChleDogdGJvZHkgaW5zaWRlIHRib2R5KVxuICAgICAgdmFyIHRuYW1lID0gcm9vdEVsc1t0YWdOYW1lXTtcbiAgICAgIGlmICh0bmFtZSAmJiBwYXJlbnQuY2hpbGRFbGVtZW50Q291bnQgPT09IDEpIHsgcGFyZW50ID0gJCh0bmFtZSwgcGFyZW50KTsgfVxuICAgIH1cbiAgICByZXR1cm4gcGFyZW50XG4gIH1cblxuICAvKlxuICAgIFJlcGxhY2UgdGhlIHlpZWxkIHRhZyBmcm9tIGFueSB0YWcgdGVtcGxhdGUgd2l0aCB0aGUgaW5uZXJIVE1MIG9mIHRoZVxuICAgIG9yaWdpbmFsIHRhZyBpbiB0aGUgcGFnZVxuICAqL1xuICBmdW5jdGlvbiByZXBsYWNlWWllbGQodG1wbCwgaHRtbCkge1xuICAgIC8vIGRvIG5vdGhpbmcgaWYgbm8geWllbGRcbiAgICBpZiAoIXJlSGFzWWllbGQudGVzdCh0bXBsKSkgeyByZXR1cm4gdG1wbCB9XG5cbiAgICAvLyBiZSBjYXJlZnVsIHdpdGggIzEzNDMgLSBzdHJpbmcgb24gdGhlIHNvdXJjZSBoYXZpbmcgYCQxYFxuICAgIHZhciBzcmMgPSB7fTtcblxuICAgIGh0bWwgPSBodG1sICYmIGh0bWwucmVwbGFjZShyZVlpZWxkU3JjLCBmdW5jdGlvbiAoXywgcmVmLCB0ZXh0KSB7XG4gICAgICBzcmNbcmVmXSA9IHNyY1tyZWZdIHx8IHRleHQ7ICAgLy8gcHJlc2VydmUgZmlyc3QgZGVmaW5pdGlvblxuICAgICAgcmV0dXJuICcnXG4gICAgfSkudHJpbSgpO1xuXG4gICAgcmV0dXJuIHRtcGxcbiAgICAgIC5yZXBsYWNlKHJlWWllbGREZXN0LCBmdW5jdGlvbiAoXywgcmVmLCBkZWYpIHsgIC8vIHlpZWxkIHdpdGggZnJvbSAtIHRvIGF0dHJzXG4gICAgICAgIHJldHVybiBzcmNbcmVmXSB8fCBkZWYgfHwgJydcbiAgICAgIH0pXG4gICAgICAucmVwbGFjZShyZVlpZWxkQWxsLCBmdW5jdGlvbiAoXywgZGVmKSB7ICAgICAgICAvLyB5aWVsZCB3aXRob3V0IGFueSBcImZyb21cIlxuICAgICAgICByZXR1cm4gaHRtbCB8fCBkZWYgfHwgJydcbiAgICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIERPTSBlbGVtZW50IHRvIHdyYXAgdGhlIGdpdmVuIGNvbnRlbnQuIE5vcm1hbGx5IGFuIGBESVZgLCBidXQgY2FuIGJlXG4gICAqIGFsc28gYSBgVEFCTEVgLCBgU0VMRUNUYCwgYFRCT0RZYCwgYFRSYCwgb3IgYENPTEdST1VQYCBlbGVtZW50LlxuICAgKlxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IHRtcGwgIC0gVGhlIHRlbXBsYXRlIGNvbWluZyBmcm9tIHRoZSBjdXN0b20gdGFnIGRlZmluaXRpb25cbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSBodG1sIC0gSFRNTCBjb250ZW50IHRoYXQgY29tZXMgZnJvbSB0aGUgRE9NIGVsZW1lbnQgd2hlcmUgeW91XG4gICAqICAgICAgICAgICB3aWxsIG1vdW50IHRoZSB0YWcsIG1vc3RseSB0aGUgb3JpZ2luYWwgdGFnIGluIHRoZSBwYWdlXG4gICAqIEBwYXJhbSAgIHsgQm9vbGVhbiB9IGlzU3ZnIC0gdHJ1ZSBpZiB0aGUgcm9vdCBub2RlIGlzIGFuIHN2Z1xuICAgKiBAcmV0dXJucyB7IEhUTUxFbGVtZW50IH0gRE9NIGVsZW1lbnQgd2l0aCBfdG1wbF8gbWVyZ2VkIHRocm91Z2ggYFlJRUxEYCB3aXRoIHRoZSBfaHRtbF8uXG4gICAqL1xuICBmdW5jdGlvbiBta2RvbSh0bXBsLCBodG1sLCBpc1N2Zykge1xuICAgIHZhciBtYXRjaCAgID0gdG1wbCAmJiB0bXBsLm1hdGNoKC9eXFxzKjwoWy1cXHddKykvKTtcbiAgICB2YXIgIHRhZ05hbWUgPSBtYXRjaCAmJiBtYXRjaFsxXS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhciBlbCA9IG1ha2VFbGVtZW50KGlzU3ZnID8gU1ZHIDogR0VORVJJQyk7XG5cbiAgICAvLyByZXBsYWNlIGFsbCB0aGUgeWllbGQgdGFncyB3aXRoIHRoZSB0YWcgaW5uZXIgaHRtbFxuICAgIHRtcGwgPSByZXBsYWNlWWllbGQodG1wbCwgaHRtbCk7XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0YmxUYWdzLnRlc3QodGFnTmFtZSkpXG4gICAgICB7IGVsID0gc3BlY2lhbFRhZ3MoZWwsIHRtcGwsIHRhZ05hbWUpOyB9XG4gICAgZWxzZVxuICAgICAgeyBzZXRJbm5lckhUTUwoZWwsIHRtcGwsIGlzU3ZnKTsgfVxuXG4gICAgcmV0dXJuIGVsXG4gIH1cblxuICB2YXIgRVZFTlRfQVRUUl9SRSA9IC9eb24vO1xuXG4gIC8qKlxuICAgKiBUcnVlIGlmIHRoZSBldmVudCBhdHRyaWJ1dGUgc3RhcnRzIHdpdGggJ29uJ1xuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGF0dHJpYnV0ZSAtIGV2ZW50IGF0dHJpYnV0ZVxuICAgKiBAcmV0dXJucyB7IEJvb2xlYW4gfVxuICAgKi9cbiAgZnVuY3Rpb24gaXNFdmVudEF0dHJpYnV0ZShhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gRVZFTlRfQVRUUl9SRS50ZXN0KGF0dHJpYnV0ZSlcbiAgfVxuXG4gIC8qKlxuICAgKiBMb29wIGJhY2t3YXJkIGFsbCB0aGUgcGFyZW50cyB0cmVlIHRvIGRldGVjdCB0aGUgZmlyc3QgY3VzdG9tIHBhcmVudCB0YWdcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSB0YWcgLSBhIFRhZyBpbnN0YW5jZVxuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IHRoZSBpbnN0YW5jZSBvZiB0aGUgZmlyc3QgY3VzdG9tIHBhcmVudCB0YWcgZm91bmRcbiAgICovXG4gIGZ1bmN0aW9uIGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudCh0YWcpIHtcbiAgICB2YXIgcHRhZyA9IHRhZztcbiAgICB3aGlsZSAocHRhZy5fXy5pc0Fub255bW91cykge1xuICAgICAgaWYgKCFwdGFnLnBhcmVudCkgeyBicmVhayB9XG4gICAgICBwdGFnID0gcHRhZy5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBwdGFnXG4gIH1cblxuICAvKipcbiAgICogVHJpZ2dlciBET00gZXZlbnRzXG4gICAqIEBwYXJhbSAgIHsgSFRNTEVsZW1lbnQgfSBkb20gLSBkb20gZWxlbWVudCB0YXJnZXQgb2YgdGhlIGV2ZW50XG4gICAqIEBwYXJhbSAgIHsgRnVuY3Rpb24gfSBoYW5kbGVyIC0gdXNlciBmdW5jdGlvblxuICAgKiBAcGFyYW0gICB7IE9iamVjdCB9IGUgLSBldmVudCBvYmplY3RcbiAgICovXG4gIGZ1bmN0aW9uIGhhbmRsZUV2ZW50KGRvbSwgaGFuZGxlciwgZSkge1xuICAgIHZhciBwdGFnID0gdGhpcy5fXy5wYXJlbnQ7XG4gICAgdmFyIGl0ZW0gPSB0aGlzLl9fLml0ZW07XG5cbiAgICBpZiAoIWl0ZW0pXG4gICAgICB7IHdoaWxlIChwdGFnICYmICFpdGVtKSB7XG4gICAgICAgIGl0ZW0gPSBwdGFnLl9fLml0ZW07XG4gICAgICAgIHB0YWcgPSBwdGFnLl9fLnBhcmVudDtcbiAgICAgIH0gfVxuXG4gICAgLy8gb3ZlcnJpZGUgdGhlIGV2ZW50IHByb3BlcnRpZXNcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmIChpc1dyaXRhYmxlKGUsICdjdXJyZW50VGFyZ2V0JykpIHsgZS5jdXJyZW50VGFyZ2V0ID0gZG9tOyB9XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAoaXNXcml0YWJsZShlLCAndGFyZ2V0JykpIHsgZS50YXJnZXQgPSBlLnNyY0VsZW1lbnQ7IH1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmIChpc1dyaXRhYmxlKGUsICd3aGljaCcpKSB7IGUud2hpY2ggPSBlLmNoYXJDb2RlIHx8IGUua2V5Q29kZTsgfVxuXG4gICAgZS5pdGVtID0gaXRlbTtcblxuICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBlKTtcblxuICAgIC8vIGF2b2lkIGF1dG8gdXBkYXRlc1xuICAgIGlmICghc2V0dGluZ3MuYXV0b1VwZGF0ZSkgeyByZXR1cm4gfVxuXG4gICAgaWYgKCFlLnByZXZlbnRVcGRhdGUpIHtcbiAgICAgIHZhciBwID0gZ2V0SW1tZWRpYXRlQ3VzdG9tUGFyZW50KHRoaXMpO1xuICAgICAgLy8gZml4ZXMgIzIwODNcbiAgICAgIGlmIChwLmlzTW91bnRlZCkgeyBwLnVwZGF0ZSgpOyB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEF0dGFjaCBhbiBldmVudCB0byBhIERPTSBub2RlXG4gICAqIEBwYXJhbSB7IFN0cmluZyB9IG5hbWUgLSBldmVudCBuYW1lXG4gICAqIEBwYXJhbSB7IEZ1bmN0aW9uIH0gaGFuZGxlciAtIGV2ZW50IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7IE9iamVjdCB9IGRvbSAtIGRvbSBub2RlXG4gICAqIEBwYXJhbSB7IFRhZyB9IHRhZyAtIHRhZyBpbnN0YW5jZVxuICAgKi9cbiAgZnVuY3Rpb24gc2V0RXZlbnRIYW5kbGVyKG5hbWUsIGhhbmRsZXIsIGRvbSwgdGFnKSB7XG4gICAgdmFyIGV2ZW50TmFtZTtcbiAgICB2YXIgY2IgPSBoYW5kbGVFdmVudC5iaW5kKHRhZywgZG9tLCBoYW5kbGVyKTtcblxuICAgIC8vIGF2b2lkIHRvIGJpbmQgdHdpY2UgdGhlIHNhbWUgZXZlbnRcbiAgICAvLyBwb3NzaWJsZSBmaXggZm9yICMyMzMyXG4gICAgZG9tW25hbWVdID0gbnVsbDtcblxuICAgIC8vIG5vcm1hbGl6ZSBldmVudCBuYW1lXG4gICAgZXZlbnROYW1lID0gbmFtZS5yZXBsYWNlKFJFX0VWRU5UU19QUkVGSVgsICcnKTtcblxuICAgIC8vIGNhY2hlIHRoZSBsaXN0ZW5lciBpbnRvIHRoZSBsaXN0ZW5lcnMgYXJyYXlcbiAgICBpZiAoIWNvbnRhaW5zKHRhZy5fXy5saXN0ZW5lcnMsIGRvbSkpIHsgdGFnLl9fLmxpc3RlbmVycy5wdXNoKGRvbSk7IH1cbiAgICBpZiAoIWRvbVtSSU9UX0VWRU5UU19LRVldKSB7IGRvbVtSSU9UX0VWRU5UU19LRVldID0ge307IH1cbiAgICBpZiAoZG9tW1JJT1RfRVZFTlRTX0tFWV1bbmFtZV0pIHsgZG9tLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBkb21bUklPVF9FVkVOVFNfS0VZXVtuYW1lXSk7IH1cblxuICAgIGRvbVtSSU9UX0VWRU5UU19LRVldW25hbWVdID0gY2I7XG4gICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYiwgZmFsc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBjaGlsZCB0YWcgaW5jbHVkaW5nIGl0IGNvcnJlY3RseSBpbnRvIGl0cyBwYXJlbnRcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBjaGlsZCAtIGNoaWxkIHRhZyBpbXBsZW1lbnRhdGlvblxuICAgKiBAcGFyYW0gICB7IE9iamVjdCB9IG9wdHMgLSB0YWcgb3B0aW9ucyBjb250YWluaW5nIHRoZSBET00gbm9kZSB3aGVyZSB0aGUgdGFnIHdpbGwgYmUgbW91bnRlZFxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGlubmVySFRNTCAtIGlubmVyIGh0bWwgb2YgdGhlIGNoaWxkIG5vZGVcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBwYXJlbnQgLSBpbnN0YW5jZSBvZiB0aGUgcGFyZW50IHRhZyBpbmNsdWRpbmcgdGhlIGNoaWxkIGN1c3RvbSB0YWdcbiAgICogQHJldHVybnMgeyBPYmplY3QgfSBpbnN0YW5jZSBvZiB0aGUgbmV3IGNoaWxkIHRhZyBqdXN0IGNyZWF0ZWRcbiAgICovXG4gIGZ1bmN0aW9uIGluaXRDaGlsZChjaGlsZCwgb3B0cywgaW5uZXJIVE1MLCBwYXJlbnQpIHtcbiAgICB2YXIgdGFnID0gY3JlYXRlVGFnKGNoaWxkLCBvcHRzLCBpbm5lckhUTUwpO1xuICAgIHZhciB0YWdOYW1lID0gb3B0cy50YWdOYW1lIHx8IGdldE5hbWUob3B0cy5yb290LCB0cnVlKTtcbiAgICB2YXIgcHRhZyA9IGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudChwYXJlbnQpO1xuICAgIC8vIGZpeCBmb3IgdGhlIHBhcmVudCBhdHRyaWJ1dGUgaW4gdGhlIGxvb3BlZCBlbGVtZW50c1xuICAgIGRlZmluZSh0YWcsICdwYXJlbnQnLCBwdGFnKTtcbiAgICAvLyBzdG9yZSB0aGUgcmVhbCBwYXJlbnQgdGFnXG4gICAgLy8gaW4gc29tZSBjYXNlcyB0aGlzIGNvdWxkIGJlIGRpZmZlcmVudCBmcm9tIHRoZSBjdXN0b20gcGFyZW50IHRhZ1xuICAgIC8vIGZvciBleGFtcGxlIGluIG5lc3RlZCBsb29wc1xuICAgIHRhZy5fXy5wYXJlbnQgPSBwYXJlbnQ7XG5cbiAgICAvLyBhZGQgdGhpcyB0YWcgdG8gdGhlIGN1c3RvbSBwYXJlbnQgdGFnXG4gICAgYXJyYXlpc2hBZGQocHRhZy50YWdzLCB0YWdOYW1lLCB0YWcpO1xuXG4gICAgLy8gYW5kIGFsc28gdG8gdGhlIHJlYWwgcGFyZW50IHRhZ1xuICAgIGlmIChwdGFnICE9PSBwYXJlbnQpXG4gICAgICB7IGFycmF5aXNoQWRkKHBhcmVudC50YWdzLCB0YWdOYW1lLCB0YWcpOyB9XG5cbiAgICByZXR1cm4gdGFnXG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBhbiBpdGVtIGZyb20gYW4gb2JqZWN0IGF0IGEgZ2l2ZW4ga2V5LiBJZiB0aGUga2V5IHBvaW50cyB0byBhbiBhcnJheSxcbiAgICogdGhlbiB0aGUgaXRlbSBpcyBqdXN0IHJlbW92ZWQgZnJvbSB0aGUgYXJyYXkuXG4gICAqIEBwYXJhbSB7IE9iamVjdCB9IG9iaiAtIG9iamVjdCBvbiB3aGljaCB0byByZW1vdmUgdGhlIHByb3BlcnR5XG4gICAqIEBwYXJhbSB7IFN0cmluZyB9IGtleSAtIHByb3BlcnR5IG5hbWVcbiAgICogQHBhcmFtIHsgT2JqZWN0IH0gdmFsdWUgLSB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5IHRvIGJlIHJlbW92ZWRcbiAgICogQHBhcmFtIHsgQm9vbGVhbiB9IGVuc3VyZUFycmF5IC0gZW5zdXJlIHRoYXQgdGhlIHByb3BlcnR5IHJlbWFpbnMgYW4gYXJyYXlcbiAgKi9cbiAgZnVuY3Rpb24gYXJyYXlpc2hSZW1vdmUob2JqLCBrZXksIHZhbHVlLCBlbnN1cmVBcnJheSkge1xuICAgIGlmIChpc0FycmF5KG9ialtrZXldKSkge1xuICAgICAgdmFyIGluZGV4ID0gb2JqW2tleV0uaW5kZXhPZih2YWx1ZSk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7IG9ialtrZXldLnNwbGljZShpbmRleCwgMSk7IH1cbiAgICAgIGlmICghb2JqW2tleV0ubGVuZ3RoKSB7IGRlbGV0ZSBvYmpba2V5XTsgfVxuICAgICAgZWxzZSBpZiAob2JqW2tleV0ubGVuZ3RoID09PSAxICYmICFlbnN1cmVBcnJheSkgeyBvYmpba2V5XSA9IG9ialtrZXldWzBdOyB9XG4gICAgfSBlbHNlIGlmIChvYmpba2V5XSA9PT0gdmFsdWUpXG4gICAgICB7IGRlbGV0ZSBvYmpba2V5XTsgfSAvLyBvdGhlcndpc2UganVzdCBkZWxldGUgdGhlIGtleVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgdGhlIGVsZW1lbnRzIGZvciBhIHZpcnR1YWwgdGFnXG4gICAqIEB0aGlzIFRhZ1xuICAgKiBAcGFyYW0geyBOb2RlIH0gc3JjIC0gdGhlIG5vZGUgdGhhdCB3aWxsIGRvIHRoZSBpbnNlcnRpbmcgb3IgYXBwZW5kaW5nXG4gICAqIEBwYXJhbSB7IFRhZyB9IHRhcmdldCAtIG9ubHkgaWYgaW5zZXJ0aW5nLCBpbnNlcnQgYmVmb3JlIHRoaXMgdGFnJ3MgZmlyc3QgY2hpbGRcbiAgICovXG4gIGZ1bmN0aW9uIG1ha2VWaXJ0dWFsKHNyYywgdGFyZ2V0KSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICB2YXIgaGVhZCA9IGNyZWF0ZURPTVBsYWNlaG9sZGVyKCk7XG4gICAgdmFyIHRhaWwgPSBjcmVhdGVET01QbGFjZWhvbGRlcigpO1xuICAgIHZhciBmcmFnID0gY3JlYXRlRnJhZ21lbnQoKTtcbiAgICB2YXIgc2liO1xuICAgIHZhciBlbDtcblxuICAgIHRoaXMucm9vdC5pbnNlcnRCZWZvcmUoaGVhZCwgdGhpcy5yb290LmZpcnN0Q2hpbGQpO1xuICAgIHRoaXMucm9vdC5hcHBlbmRDaGlsZCh0YWlsKTtcblxuICAgIHRoaXMuX18uaGVhZCA9IGVsID0gaGVhZDtcbiAgICB0aGlzLl9fLnRhaWwgPSB0YWlsO1xuXG4gICAgd2hpbGUgKGVsKSB7XG4gICAgICBzaWIgPSBlbC5uZXh0U2libGluZztcbiAgICAgIGZyYWcuYXBwZW5kQ2hpbGQoZWwpO1xuICAgICAgdGhpcyQxLl9fLnZpcnRzLnB1c2goZWwpOyAvLyBob2xkIGZvciB1bm1vdW50aW5nXG4gICAgICBlbCA9IHNpYjtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0KVxuICAgICAgeyBzcmMuaW5zZXJ0QmVmb3JlKGZyYWcsIHRhcmdldC5fXy5oZWFkKTsgfVxuICAgIGVsc2VcbiAgICAgIHsgc3JjLmFwcGVuZENoaWxkKGZyYWcpOyB9XG4gIH1cblxuICAvKipcbiAgICogbWFrZXMgYSB0YWcgdmlydHVhbCBhbmQgcmVwbGFjZXMgYSByZWZlcmVuY2UgaW4gdGhlIGRvbVxuICAgKiBAdGhpcyBUYWdcbiAgICogQHBhcmFtIHsgdGFnIH0gdGhlIHRhZyB0byBtYWtlIHZpcnR1YWxcbiAgICogQHBhcmFtIHsgcmVmIH0gdGhlIGRvbSByZWZlcmVuY2UgbG9jYXRpb25cbiAgICovXG4gIGZ1bmN0aW9uIG1ha2VSZXBsYWNlVmlydHVhbCh0YWcsIHJlZikge1xuICAgIGlmICghcmVmLnBhcmVudE5vZGUpIHsgcmV0dXJuIH1cbiAgICB2YXIgZnJhZyA9IGNyZWF0ZUZyYWdtZW50KCk7XG4gICAgbWFrZVZpcnR1YWwuY2FsbCh0YWcsIGZyYWcpO1xuICAgIHJlZi5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChmcmFnLCByZWYpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBkeW5hbWljYWxseSBjcmVhdGVkIGRhdGEtaXMgdGFncyB3aXRoIGNoYW5naW5nIGV4cHJlc3Npb25zXG4gICAqIEBwYXJhbSB7IE9iamVjdCB9IGV4cHIgLSBleHByZXNzaW9uIHRhZyBhbmQgZXhwcmVzc2lvbiBpbmZvXG4gICAqIEBwYXJhbSB7IFRhZyB9ICAgIHBhcmVudCAtIHBhcmVudCBmb3IgdGFnIGNyZWF0aW9uXG4gICAqIEBwYXJhbSB7IFN0cmluZyB9IHRhZ05hbWUgLSB0YWcgaW1wbGVtZW50YXRpb24gd2Ugd2FudCB0byB1c2VcbiAgICovXG4gIGZ1bmN0aW9uIHVwZGF0ZURhdGFJcyhleHByLCBwYXJlbnQsIHRhZ05hbWUpIHtcbiAgICB2YXIgdGFnID0gZXhwci50YWcgfHwgZXhwci5kb20uX3RhZztcbiAgICB2YXIgcmVmO1xuXG4gICAgdmFyIHJlZiQxID0gdGFnID8gdGFnLl9fIDoge307XG4gICAgdmFyIGhlYWQgPSByZWYkMS5oZWFkO1xuICAgIHZhciBpc1ZpcnR1YWwgPSBleHByLmRvbS50YWdOYW1lID09PSAnVklSVFVBTCc7XG5cbiAgICBpZiAodGFnICYmIGV4cHIudGFnTmFtZSA9PT0gdGFnTmFtZSkge1xuICAgICAgdGFnLnVwZGF0ZSgpO1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gc3luYyBfcGFyZW50IHRvIGFjY29tbW9kYXRlIGNoYW5naW5nIHRhZ25hbWVzXG4gICAgaWYgKHRhZykge1xuICAgICAgLy8gbmVlZCBwbGFjZWhvbGRlciBiZWZvcmUgdW5tb3VudFxuICAgICAgaWYoaXNWaXJ0dWFsKSB7XG4gICAgICAgIHJlZiA9IGNyZWF0ZURPTVBsYWNlaG9sZGVyKCk7XG4gICAgICAgIGhlYWQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVmLCBoZWFkKTtcbiAgICAgIH1cblxuICAgICAgdGFnLnVubW91bnQodHJ1ZSk7XG4gICAgfVxuXG4gICAgLy8gdW5hYmxlIHRvIGdldCB0aGUgdGFnIG5hbWVcbiAgICBpZiAoIWlzU3RyaW5nKHRhZ05hbWUpKSB7IHJldHVybiB9XG5cbiAgICBleHByLmltcGwgPSBfX1RBR19JTVBMW3RhZ05hbWVdO1xuXG4gICAgLy8gdW5rbm93biBpbXBsZW1lbnRhdGlvblxuICAgIGlmICghZXhwci5pbXBsKSB7IHJldHVybiB9XG5cbiAgICBleHByLnRhZyA9IHRhZyA9IGluaXRDaGlsZChcbiAgICAgIGV4cHIuaW1wbCwge1xuICAgICAgICByb290OiBleHByLmRvbSxcbiAgICAgICAgcGFyZW50OiBwYXJlbnQsXG4gICAgICAgIHRhZ05hbWU6IHRhZ05hbWVcbiAgICAgIH0sXG4gICAgICBleHByLmRvbS5pbm5lckhUTUwsXG4gICAgICBwYXJlbnRcbiAgICApO1xuXG4gICAgZWFjaChleHByLmF0dHJzLCBmdW5jdGlvbiAoYSkgeyByZXR1cm4gc2V0QXR0cmlidXRlKHRhZy5yb290LCBhLm5hbWUsIGEudmFsdWUpOyB9KTtcbiAgICBleHByLnRhZ05hbWUgPSB0YWdOYW1lO1xuICAgIHRhZy5tb3VudCgpO1xuXG4gICAgLy8gcm9vdCBleGlzdCBmaXJzdCB0aW1lLCBhZnRlciB1c2UgcGxhY2Vob2xkZXJcbiAgICBpZiAoaXNWaXJ0dWFsKSB7IG1ha2VSZXBsYWNlVmlydHVhbCh0YWcsIHJlZiB8fCB0YWcucm9vdCk7IH1cblxuICAgIC8vIHBhcmVudCBpcyB0aGUgcGxhY2Vob2xkZXIgdGFnLCBub3QgdGhlIGR5bmFtaWMgdGFnIHNvIGNsZWFuIHVwXG4gICAgcGFyZW50Ll9fLm9uVW5tb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBkZWxOYW1lID0gdGFnLm9wdHMuZGF0YUlzO1xuICAgICAgYXJyYXlpc2hSZW1vdmUodGFnLnBhcmVudC50YWdzLCBkZWxOYW1lLCB0YWcpO1xuICAgICAgYXJyYXlpc2hSZW1vdmUodGFnLl9fLnBhcmVudC50YWdzLCBkZWxOYW1lLCB0YWcpO1xuICAgICAgdGFnLnVubW91bnQoKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIE5vbWFsaXplIGFueSBhdHRyaWJ1dGUgcmVtb3ZpbmcgdGhlIFwicmlvdC1cIiBwcmVmaXhcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSBhdHRyTmFtZSAtIG9yaWdpbmFsIGF0dHJpYnV0ZSBuYW1lXG4gICAqIEByZXR1cm5zIHsgU3RyaW5nIH0gdmFsaWQgaHRtbCBhdHRyaWJ1dGUgbmFtZVxuICAgKi9cbiAgZnVuY3Rpb24gbm9ybWFsaXplQXR0ck5hbWUoYXR0ck5hbWUpIHtcbiAgICBpZiAoIWF0dHJOYW1lKSB7IHJldHVybiBudWxsIH1cbiAgICBhdHRyTmFtZSA9IGF0dHJOYW1lLnJlcGxhY2UoQVRUUlNfUFJFRklYLCAnJyk7XG4gICAgaWYgKENBU0VfU0VOU0lUSVZFX0FUVFJJQlVURVNbYXR0ck5hbWVdKSB7IGF0dHJOYW1lID0gQ0FTRV9TRU5TSVRJVkVfQVRUUklCVVRFU1thdHRyTmFtZV07IH1cbiAgICByZXR1cm4gYXR0ck5hbWVcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgb24gc2luZ2xlIHRhZyBleHByZXNzaW9uXG4gICAqIEB0aGlzIFRhZ1xuICAgKiBAcGFyYW0geyBPYmplY3QgfSBleHByIC0gZXhwcmVzc2lvbiBsb2dpY1xuICAgKiBAcmV0dXJucyB7IHVuZGVmaW5lZCB9XG4gICAqL1xuICBmdW5jdGlvbiB1cGRhdGVFeHByZXNzaW9uKGV4cHIpIHtcbiAgICBpZiAodGhpcy5yb290ICYmIGdldEF0dHJpYnV0ZSh0aGlzLnJvb3QsJ3ZpcnR1YWxpemVkJykpIHsgcmV0dXJuIH1cblxuICAgIHZhciBkb20gPSBleHByLmRvbTtcbiAgICAvLyByZW1vdmUgdGhlIHJpb3QtIHByZWZpeFxuICAgIHZhciBhdHRyTmFtZSA9IG5vcm1hbGl6ZUF0dHJOYW1lKGV4cHIuYXR0cik7XG4gICAgdmFyIGlzVG9nZ2xlID0gY29udGFpbnMoW1NIT1dfRElSRUNUSVZFLCBISURFX0RJUkVDVElWRV0sIGF0dHJOYW1lKTtcbiAgICB2YXIgaXNWaXJ0dWFsID0gZXhwci5yb290ICYmIGV4cHIucm9vdC50YWdOYW1lID09PSAnVklSVFVBTCc7XG4gICAgdmFyIHJlZiA9IHRoaXMuX187XG4gICAgdmFyIGlzQW5vbnltb3VzID0gcmVmLmlzQW5vbnltb3VzO1xuICAgIHZhciBwYXJlbnQgPSBkb20gJiYgKGV4cHIucGFyZW50IHx8IGRvbS5wYXJlbnROb2RlKTtcbiAgICB2YXIga2VlcFZhbHVlQXR0cmlidXRlcyA9IHNldHRpbmdzLmtlZXBWYWx1ZUF0dHJpYnV0ZXM7XG4gICAgLy8gZGV0ZWN0IHRoZSBzdHlsZSBhdHRyaWJ1dGVzXG4gICAgdmFyIGlzU3R5bGVBdHRyID0gYXR0ck5hbWUgPT09ICdzdHlsZSc7XG4gICAgdmFyIGlzQ2xhc3NBdHRyID0gYXR0ck5hbWUgPT09ICdjbGFzcyc7XG4gICAgdmFyIGlzVmFsdWVBdHRyID0gYXR0ck5hbWUgPT09ICd2YWx1ZSc7XG5cbiAgICB2YXIgdmFsdWU7XG5cbiAgICAvLyBpZiBpdCdzIGEgdGFnIHdlIGNvdWxkIHRvdGFsbHkgc2tpcCB0aGUgcmVzdFxuICAgIGlmIChleHByLl9yaW90X2lkKSB7XG4gICAgICBpZiAoZXhwci5fXy53YXNDcmVhdGVkKSB7XG4gICAgICAgIGV4cHIudXBkYXRlKCk7XG4gICAgICAvLyBpZiBpdCBoYXNuJ3QgYmVlbiBtb3VudGVkIHlldCwgZG8gdGhhdCBub3cuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleHByLm1vdW50KCk7XG4gICAgICAgIGlmIChpc1ZpcnR1YWwpIHtcbiAgICAgICAgICBtYWtlUmVwbGFjZVZpcnR1YWwoZXhwciwgZXhwci5yb290KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gaWYgdGhpcyBleHByZXNzaW9uIGhhcyB0aGUgdXBkYXRlIG1ldGhvZCBpdCBtZWFucyBpdCBjYW4gaGFuZGxlIHRoZSBET00gY2hhbmdlcyBieSBpdHNlbGZcbiAgICBpZiAoZXhwci51cGRhdGUpIHsgcmV0dXJuIGV4cHIudXBkYXRlKCkgfVxuXG4gICAgdmFyIGNvbnRleHQgPSBpc1RvZ2dsZSAmJiAhaXNBbm9ueW1vdXMgPyBpbmhlcml0UGFyZW50UHJvcHMuY2FsbCh0aGlzKSA6IHRoaXM7XG5cbiAgICAvLyAuLi5pdCBzZWVtcyB0byBiZSBhIHNpbXBsZSBleHByZXNzaW9uIHNvIHdlIHRyeSB0byBjYWxjdWxhdGUgaXRzIHZhbHVlXG4gICAgdmFsdWUgPSB0bXBsKGV4cHIuZXhwciwgY29udGV4dCk7XG5cbiAgICB2YXIgaGFzVmFsdWUgPSAhaXNCbGFuayh2YWx1ZSk7XG4gICAgdmFyIGlzT2JqID0gaXNPYmplY3QodmFsdWUpO1xuXG4gICAgLy8gY29udmVydCB0aGUgc3R5bGUvY2xhc3Mgb2JqZWN0cyB0byBzdHJpbmdzXG4gICAgaWYgKGlzT2JqKSB7XG4gICAgICBpZiAoaXNDbGFzc0F0dHIpIHtcbiAgICAgICAgdmFsdWUgPSB0bXBsKEpTT04uc3RyaW5naWZ5KHZhbHVlKSwgdGhpcyk7XG4gICAgICB9IGVsc2UgaWYgKGlzU3R5bGVBdHRyKSB7XG4gICAgICAgIHZhbHVlID0gc3R5bGVPYmplY3RUb1N0cmluZyh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIG9yaWdpbmFsIGF0dHJpYnV0ZVxuICAgIGlmIChleHByLmF0dHIgJiZcbiAgICAgICAgKFxuICAgICAgICAgIC8vIHRoZSBvcmlnaW5hbCBhdHRyaWJ1dGUgY2FuIGJlIHJlbW92ZWQgb25seSBpZiB3ZSBhcmUgcGFyc2luZyB0aGUgb3JpZ2luYWwgZXhwcmVzc2lvblxuICAgICAgICAgICFleHByLndhc1BhcnNlZE9uY2UgfHxcbiAgICAgICAgICAvLyBvciBpdHMgdmFsdWUgaXMgZmFsc2VcbiAgICAgICAgICB2YWx1ZSA9PT0gZmFsc2UgfHxcbiAgICAgICAgICAvLyBvciBpZiBpdHMgdmFsdWUgaXMgY3VycmVudGx5IGZhbHN5Li4uXG4gICAgICAgICAgLy8gV2Ugd2lsbCBrZWVwIHRoZSBcInZhbHVlXCIgYXR0cmlidXRlcyBpZiB0aGUgXCJrZWVwVmFsdWVBdHRyaWJ1dGVzXCJcbiAgICAgICAgICAvLyBpcyBlbmFibGVkIHRob3VnaFxuICAgICAgICAgICghaGFzVmFsdWUgJiYgKCFpc1ZhbHVlQXR0ciB8fCBpc1ZhbHVlQXR0ciAmJiAha2VlcFZhbHVlQXR0cmlidXRlcykpXG4gICAgICAgIClcbiAgICApIHtcbiAgICAgIC8vIHJlbW92ZSBlaXRoZXIgcmlvdC0qIGF0dHJpYnV0ZXMgb3IganVzdCB0aGUgYXR0cmlidXRlIG5hbWVcbiAgICAgIHJlbW92ZUF0dHJpYnV0ZShkb20sIGdldEF0dHJpYnV0ZShkb20sIGV4cHIuYXR0cikgPyBleHByLmF0dHIgOiBhdHRyTmFtZSk7XG4gICAgfVxuXG4gICAgLy8gZm9yIHRoZSBib29sZWFuIGF0dHJpYnV0ZXMgd2UgZG9uJ3QgbmVlZCB0aGUgdmFsdWVcbiAgICAvLyB3ZSBjYW4gY29udmVydCBpdCB0byBjaGVja2VkPXRydWUgdG8gY2hlY2tlZD1jaGVja2VkXG4gICAgaWYgKGV4cHIuYm9vbCkgeyB2YWx1ZSA9IHZhbHVlID8gYXR0ck5hbWUgOiBmYWxzZTsgfVxuICAgIGlmIChleHByLmlzUnRhZykgeyByZXR1cm4gdXBkYXRlRGF0YUlzKGV4cHIsIHRoaXMsIHZhbHVlKSB9XG4gICAgaWYgKGV4cHIud2FzUGFyc2VkT25jZSAmJiBleHByLnZhbHVlID09PSB2YWx1ZSkgeyByZXR1cm4gfVxuXG4gICAgLy8gdXBkYXRlIHRoZSBleHByZXNzaW9uIHZhbHVlXG4gICAgZXhwci52YWx1ZSA9IHZhbHVlO1xuICAgIGV4cHIud2FzUGFyc2VkT25jZSA9IHRydWU7XG5cbiAgICAvLyBpZiB0aGUgdmFsdWUgaXMgYW4gb2JqZWN0IChhbmQgaXQncyBub3QgYSBzdHlsZSBvciBjbGFzcyBhdHRyaWJ1dGUpIHdlIGNhbiBub3QgZG8gbXVjaCBtb3JlIHdpdGggaXRcbiAgICBpZiAoaXNPYmogJiYgIWlzQ2xhc3NBdHRyICYmICFpc1N0eWxlQXR0ciAmJiAhaXNUb2dnbGUpIHsgcmV0dXJuIH1cbiAgICAvLyBhdm9pZCB0byByZW5kZXIgdW5kZWZpbmVkL251bGwgdmFsdWVzXG4gICAgaWYgKCFoYXNWYWx1ZSkgeyB2YWx1ZSA9ICcnOyB9XG5cbiAgICAvLyB0ZXh0YXJlYSBhbmQgdGV4dCBub2RlcyBoYXZlIG5vIGF0dHJpYnV0ZSBuYW1lXG4gICAgaWYgKCFhdHRyTmFtZSkge1xuICAgICAgLy8gYWJvdXQgIzgxNSB3L28gcmVwbGFjZTogdGhlIGJyb3dzZXIgY29udmVydHMgdGhlIHZhbHVlIHRvIGEgc3RyaW5nLFxuICAgICAgLy8gdGhlIGNvbXBhcmlzb24gYnkgXCI9PVwiIGRvZXMgdG9vLCBidXQgbm90IGluIHRoZSBzZXJ2ZXJcbiAgICAgIHZhbHVlICs9ICcnO1xuICAgICAgLy8gdGVzdCBmb3IgcGFyZW50IGF2b2lkcyBlcnJvciB3aXRoIGludmFsaWQgYXNzaWdubWVudCB0byBub2RlVmFsdWVcbiAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgLy8gY2FjaGUgdGhlIHBhcmVudCBub2RlIGJlY2F1c2Ugc29tZWhvdyBpdCB3aWxsIGJlY29tZSBudWxsIG9uIElFXG4gICAgICAgIC8vIG9uIHRoZSBuZXh0IGl0ZXJhdGlvblxuICAgICAgICBleHByLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgaWYgKHBhcmVudC50YWdOYW1lID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgICAgcGFyZW50LnZhbHVlID0gdmFsdWU7ICAgICAgICAgICAgICAgICAgICAvLyAjMTExM1xuICAgICAgICAgIGlmICghSUVfVkVSU0lPTikgeyBkb20ubm9kZVZhbHVlID0gdmFsdWU7IH0gIC8vICMxNjI1IElFIHRocm93cyBoZXJlLCBub2RlVmFsdWVcbiAgICAgICAgfSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2lsbCBiZSBhdmFpbGFibGUgb24gJ3VwZGF0ZWQnXG4gICAgICAgIGVsc2UgeyBkb20ubm9kZVZhbHVlID0gdmFsdWU7IH1cbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHN3aXRjaCAodHJ1ZSkge1xuICAgIC8vIGhhbmRsZSBldmVudHMgYmluZGluZ1xuICAgIGNhc2UgaXNGdW5jdGlvbih2YWx1ZSk6XG4gICAgICBpZiAoaXNFdmVudEF0dHJpYnV0ZShhdHRyTmFtZSkpIHtcbiAgICAgICAgc2V0RXZlbnRIYW5kbGVyKGF0dHJOYW1lLCB2YWx1ZSwgZG9tLCB0aGlzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrXG4gICAgLy8gc2hvdyAvIGhpZGVcbiAgICBjYXNlIGlzVG9nZ2xlOlxuICAgICAgdG9nZ2xlVmlzaWJpbGl0eShkb20sIGF0dHJOYW1lID09PSBISURFX0RJUkVDVElWRSA/ICF2YWx1ZSA6IHZhbHVlKTtcbiAgICAgIGJyZWFrXG4gICAgLy8gaGFuZGxlIGF0dHJpYnV0ZXNcbiAgICBkZWZhdWx0OlxuICAgICAgaWYgKGV4cHIuYm9vbCkge1xuICAgICAgICBkb21bYXR0ck5hbWVdID0gdmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc1ZhbHVlQXR0ciAmJiBkb20udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgIGRvbS52YWx1ZSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChoYXNWYWx1ZSAmJiB2YWx1ZSAhPT0gZmFsc2UpIHtcbiAgICAgICAgc2V0QXR0cmlidXRlKGRvbSwgYXR0ck5hbWUsIHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgaW4gY2FzZSBvZiBzdHlsZSBjaGFuZ2VzXG4gICAgICAvLyB0aGUgZWxlbWVudCBzdGF5cyBoaWRkZW5cbiAgICAgIGlmIChpc1N0eWxlQXR0ciAmJiBkb20uaGlkZGVuKSB7IHRvZ2dsZVZpc2liaWxpdHkoZG9tLCBmYWxzZSk7IH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIGFsbCB0aGUgZXhwcmVzc2lvbnMgaW4gYSBUYWcgaW5zdGFuY2VcbiAgICogQHRoaXMgVGFnXG4gICAqIEBwYXJhbSB7IEFycmF5IH0gZXhwcmVzc2lvbnMgLSBleHByZXNzaW9uIHRoYXQgbXVzdCBiZSByZSBldmFsdWF0ZWRcbiAgICovXG4gIGZ1bmN0aW9uIHVwZGF0ZShleHByZXNzaW9ucykge1xuICAgIGVhY2goZXhwcmVzc2lvbnMsIHVwZGF0ZUV4cHJlc3Npb24uYmluZCh0aGlzKSk7XG4gIH1cblxuICAvKipcbiAgICogV2UgbmVlZCB0byB1cGRhdGUgb3B0cyBmb3IgdGhpcyB0YWcuIFRoYXQgcmVxdWlyZXMgdXBkYXRpbmcgdGhlIGV4cHJlc3Npb25zXG4gICAqIGluIGFueSBhdHRyaWJ1dGVzIG9uIHRoZSB0YWcsIGFuZCB0aGVuIGNvcHlpbmcgdGhlIHJlc3VsdCBvbnRvIG9wdHMuXG4gICAqIEB0aGlzIFRhZ1xuICAgKiBAcGFyYW0gICB7Qm9vbGVhbn0gaXNMb29wIC0gaXMgaXQgYSBsb29wIHRhZz9cbiAgICogQHBhcmFtICAgeyBUYWcgfSAgcGFyZW50IC0gcGFyZW50IHRhZyBub2RlXG4gICAqIEBwYXJhbSAgIHsgQm9vbGVhbiB9ICBpc0Fub255bW91cyAtIGlzIGl0IGEgdGFnIHdpdGhvdXQgYW55IGltcGw/IChhIHRhZyBub3QgcmVnaXN0ZXJlZClcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSAgb3B0cyAtIHRhZyBvcHRpb25zXG4gICAqIEBwYXJhbSAgIHsgQXJyYXkgfSAgaW5zdEF0dHJzIC0gdGFnIGF0dHJpYnV0ZXMgYXJyYXlcbiAgICovXG4gIGZ1bmN0aW9uIHVwZGF0ZU9wdHMoaXNMb29wLCBwYXJlbnQsIGlzQW5vbnltb3VzLCBvcHRzLCBpbnN0QXR0cnMpIHtcbiAgICAvLyBpc0Fub255bW91cyBgZWFjaGAgdGFncyB0cmVhdCBgZG9tYCBhbmQgYHJvb3RgIGRpZmZlcmVudGx5LiBJbiB0aGlzIGNhc2VcbiAgICAvLyAoYW5kIG9ubHkgdGhpcyBjYXNlKSB3ZSBkb24ndCBuZWVkIHRvIGRvIHVwZGF0ZU9wdHMsIGJlY2F1c2UgdGhlIHJlZ3VsYXIgcGFyc2VcbiAgICAvLyB3aWxsIHVwZGF0ZSB0aG9zZSBhdHRycy4gUGx1cywgaXNBbm9ueW1vdXMgdGFncyBkb24ndCBuZWVkIG9wdHMgYW55d2F5XG4gICAgaWYgKGlzTG9vcCAmJiBpc0Fub255bW91cykgeyByZXR1cm4gfVxuICAgIHZhciBjdHggPSBpc0xvb3AgPyBpbmhlcml0UGFyZW50UHJvcHMuY2FsbCh0aGlzKSA6IHBhcmVudCB8fCB0aGlzO1xuXG4gICAgZWFjaChpbnN0QXR0cnMsIGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICBpZiAoYXR0ci5leHByKSB7IHVwZGF0ZUV4cHJlc3Npb24uY2FsbChjdHgsIGF0dHIuZXhwcik7IH1cbiAgICAgIC8vIG5vcm1hbGl6ZSB0aGUgYXR0cmlidXRlIG5hbWVzXG4gICAgICBvcHRzW3RvQ2FtZWwoYXR0ci5uYW1lKS5yZXBsYWNlKEFUVFJTX1BSRUZJWCwgJycpXSA9IGF0dHIuZXhwciA/IGF0dHIuZXhwci52YWx1ZSA6IGF0dHIudmFsdWU7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSB0YWcgZXhwcmVzc2lvbnMgYW5kIG9wdGlvbnNcbiAgICogQHBhcmFtIHsgVGFnIH0gdGFnIC0gdGFnIG9iamVjdFxuICAgKiBAcGFyYW0geyAqIH0gZGF0YSAtIGRhdGEgd2Ugd2FudCB0byB1c2UgdG8gZXh0ZW5kIHRoZSB0YWcgcHJvcGVydGllc1xuICAgKiBAcGFyYW0geyBBcnJheSB9IGV4cHJlc3Npb25zIC0gY29tcG9uZW50IGV4cHJlc3Npb25zIGFycmF5XG4gICAqIEByZXR1cm5zIHsgVGFnIH0gdGhlIGN1cnJlbnQgdGFnIGluc3RhbmNlXG4gICAqL1xuICBmdW5jdGlvbiBjb21wb25lbnRVcGRhdGUodGFnLCBkYXRhLCBleHByZXNzaW9ucykge1xuICAgIHZhciBfXyA9IHRhZy5fXztcbiAgICB2YXIgbmV4dE9wdHMgPSB7fTtcbiAgICB2YXIgY2FuVHJpZ2dlciA9IHRhZy5pc01vdW50ZWQgJiYgIV9fLnNraXBBbm9ueW1vdXM7XG5cbiAgICAvLyBpbmhlcml0IHByb3BlcnRpZXMgZnJvbSB0aGUgcGFyZW50IHRhZ1xuICAgIGlmIChfXy5pc0Fub255bW91cyAmJiBfXy5wYXJlbnQpIHsgZXh0ZW5kKHRhZywgX18ucGFyZW50KTsgfVxuICAgIGV4dGVuZCh0YWcsIGRhdGEpO1xuXG4gICAgdXBkYXRlT3B0cy5hcHBseSh0YWcsIFtfXy5pc0xvb3AsIF9fLnBhcmVudCwgX18uaXNBbm9ueW1vdXMsIG5leHRPcHRzLCBfXy5pbnN0QXR0cnNdKTtcblxuICAgIGlmIChcbiAgICAgIGNhblRyaWdnZXIgJiZcbiAgICAgIHRhZy5pc01vdW50ZWQgJiZcbiAgICAgIGlzRnVuY3Rpb24odGFnLnNob3VsZFVwZGF0ZSkgJiYgIXRhZy5zaG91bGRVcGRhdGUoZGF0YSwgbmV4dE9wdHMpXG4gICAgKSB7XG4gICAgICByZXR1cm4gdGFnXG4gICAgfVxuXG4gICAgZXh0ZW5kKHRhZy5vcHRzLCBuZXh0T3B0cyk7XG5cbiAgICBpZiAoY2FuVHJpZ2dlcikgeyB0YWcudHJpZ2dlcigndXBkYXRlJywgZGF0YSk7IH1cbiAgICB1cGRhdGUuY2FsbCh0YWcsIGV4cHJlc3Npb25zKTtcbiAgICBpZiAoY2FuVHJpZ2dlcikgeyB0YWcudHJpZ2dlcigndXBkYXRlZCcpOyB9XG5cbiAgICByZXR1cm4gdGFnXG4gIH1cblxuICAvKipcbiAgICogR2V0IHNlbGVjdG9ycyBmb3IgdGFnc1xuICAgKiBAcGFyYW0gICB7IEFycmF5IH0gdGFncyAtIHRhZyBuYW1lcyB0byBzZWxlY3RcbiAgICogQHJldHVybnMgeyBTdHJpbmcgfSBzZWxlY3RvclxuICAgKi9cbiAgZnVuY3Rpb24gcXVlcnkodGFncykge1xuICAgIC8vIHNlbGVjdCBhbGwgdGFnc1xuICAgIGlmICghdGFncykge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhfX1RBR19JTVBMKTtcbiAgICAgIHJldHVybiBrZXlzICsgcXVlcnkoa2V5cylcbiAgICB9XG5cbiAgICByZXR1cm4gdGFnc1xuICAgICAgLmZpbHRlcihmdW5jdGlvbiAodCkgeyByZXR1cm4gIS9bXi1cXHddLy50ZXN0KHQpOyB9KVxuICAgICAgLnJlZHVjZShmdW5jdGlvbiAobGlzdCwgdCkge1xuICAgICAgICB2YXIgbmFtZSA9IHQudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHJldHVybiBsaXN0ICsgXCIsW1wiICsgSVNfRElSRUNUSVZFICsgXCI9XFxcIlwiICsgbmFtZSArIFwiXFxcIl1cIlxuICAgICAgfSwgJycpXG4gIH1cblxuICAvKipcbiAgICogQW5vdGhlciB3YXkgdG8gY3JlYXRlIGEgcmlvdCB0YWcgYSBiaXQgbW9yZSBlczYgZnJpZW5kbHlcbiAgICogQHBhcmFtIHsgSFRNTEVsZW1lbnQgfSBlbCAtIHRhZyBET00gc2VsZWN0b3Igb3IgRE9NIG5vZGUvc1xuICAgKiBAcGFyYW0geyBPYmplY3QgfSBvcHRzIC0gdGFnIGxvZ2ljXG4gICAqIEByZXR1cm5zIHsgVGFnIH0gbmV3IHJpb3QgdGFnIGluc3RhbmNlXG4gICAqL1xuICBmdW5jdGlvbiBUYWcoZWwsIG9wdHMpIHtcbiAgICAvLyBnZXQgdGhlIHRhZyBwcm9wZXJ0aWVzIGZyb20gdGhlIGNsYXNzIGNvbnN0cnVjdG9yXG4gICAgdmFyIHJlZiA9IHRoaXM7XG4gICAgdmFyIG5hbWUgPSByZWYubmFtZTtcbiAgICB2YXIgdG1wbCA9IHJlZi50bXBsO1xuICAgIHZhciBjc3MgPSByZWYuY3NzO1xuICAgIHZhciBhdHRycyA9IHJlZi5hdHRycztcbiAgICB2YXIgb25DcmVhdGUgPSByZWYub25DcmVhdGU7XG4gICAgLy8gcmVnaXN0ZXIgYSBuZXcgdGFnIGFuZCBjYWNoZSB0aGUgY2xhc3MgcHJvdG90eXBlXG4gICAgaWYgKCFfX1RBR19JTVBMW25hbWVdKSB7XG4gICAgICB0YWcobmFtZSwgdG1wbCwgY3NzLCBhdHRycywgb25DcmVhdGUpO1xuICAgICAgLy8gY2FjaGUgdGhlIGNsYXNzIGNvbnN0cnVjdG9yXG4gICAgICBfX1RBR19JTVBMW25hbWVdLmNsYXNzID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICB9XG5cbiAgICAvLyBtb3VudCB0aGUgdGFnIHVzaW5nIHRoZSBjbGFzcyBpbnN0YW5jZVxuICAgIG1vdW50JDEoZWwsIG5hbWUsIG9wdHMsIHRoaXMpO1xuICAgIC8vIGluamVjdCB0aGUgY29tcG9uZW50IGNzc1xuICAgIGlmIChjc3MpIHsgc3R5bGVNYW5hZ2VyLmluamVjdCgpOyB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyByaW90IHRhZyBpbXBsZW1lbnRhdGlvblxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9ICAgbmFtZSAtIG5hbWUvaWQgb2YgdGhlIG5ldyByaW90IHRhZ1xuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9ICAgdG1wbCAtIHRhZyB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9ICAgY3NzIC0gY3VzdG9tIHRhZyBjc3NcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIGF0dHJzIC0gcm9vdCB0YWcgYXR0cmlidXRlc1xuICAgKiBAcGFyYW0gICB7IEZ1bmN0aW9uIH0gZm4gLSB1c2VyIGZ1bmN0aW9uXG4gICAqIEByZXR1cm5zIHsgU3RyaW5nIH0gbmFtZS9pZCBvZiB0aGUgdGFnIGp1c3QgY3JlYXRlZFxuICAgKi9cbiAgZnVuY3Rpb24gdGFnKG5hbWUsIHRtcGwsIGNzcywgYXR0cnMsIGZuKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oYXR0cnMpKSB7XG4gICAgICBmbiA9IGF0dHJzO1xuXG4gICAgICBpZiAoL15bXFx3LV0rXFxzPz0vLnRlc3QoY3NzKSkge1xuICAgICAgICBhdHRycyA9IGNzcztcbiAgICAgICAgY3NzID0gJyc7XG4gICAgICB9IGVsc2VcbiAgICAgICAgeyBhdHRycyA9ICcnOyB9XG4gICAgfVxuXG4gICAgaWYgKGNzcykge1xuICAgICAgaWYgKGlzRnVuY3Rpb24oY3NzKSlcbiAgICAgICAgeyBmbiA9IGNzczsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IHN0eWxlTWFuYWdlci5hZGQoY3NzLCBuYW1lKTsgfVxuICAgIH1cblxuICAgIG5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgX19UQUdfSU1QTFtuYW1lXSA9IHsgbmFtZTogbmFtZSwgdG1wbDogdG1wbCwgYXR0cnM6IGF0dHJzLCBmbjogZm4gfTtcblxuICAgIHJldHVybiBuYW1lXG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IHJpb3QgdGFnIGltcGxlbWVudGF0aW9uIChmb3IgdXNlIGJ5IHRoZSBjb21waWxlcilcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIG5hbWUgLSBuYW1lL2lkIG9mIHRoZSBuZXcgcmlvdCB0YWdcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIHRtcGwgLSB0YWcgdGVtcGxhdGVcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIGNzcyAtIGN1c3RvbSB0YWcgY3NzXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gICBhdHRycyAtIHJvb3QgdGFnIGF0dHJpYnV0ZXNcbiAgICogQHBhcmFtICAgeyBGdW5jdGlvbiB9IGZuIC0gdXNlciBmdW5jdGlvblxuICAgKiBAcmV0dXJucyB7IFN0cmluZyB9IG5hbWUvaWQgb2YgdGhlIHRhZyBqdXN0IGNyZWF0ZWRcbiAgICovXG4gIGZ1bmN0aW9uIHRhZzIobmFtZSwgdG1wbCwgY3NzLCBhdHRycywgZm4pIHtcbiAgICBpZiAoY3NzKSB7IHN0eWxlTWFuYWdlci5hZGQoY3NzLCBuYW1lKTsgfVxuXG4gICAgX19UQUdfSU1QTFtuYW1lXSA9IHsgbmFtZTogbmFtZSwgdG1wbDogdG1wbCwgYXR0cnM6IGF0dHJzLCBmbjogZm4gfTtcblxuICAgIHJldHVybiBuYW1lXG4gIH1cblxuICAvKipcbiAgICogTW91bnQgYSB0YWcgdXNpbmcgYSBzcGVjaWZpYyB0YWcgaW1wbGVtZW50YXRpb25cbiAgICogQHBhcmFtICAgeyAqIH0gc2VsZWN0b3IgLSB0YWcgRE9NIHNlbGVjdG9yIG9yIERPTSBub2RlL3NcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSB0YWdOYW1lIC0gdGFnIGltcGxlbWVudGF0aW9uIG5hbWVcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBvcHRzIC0gdGFnIGxvZ2ljXG4gICAqIEByZXR1cm5zIHsgQXJyYXkgfSBuZXcgdGFncyBpbnN0YW5jZXNcbiAgICovXG4gIGZ1bmN0aW9uIG1vdW50KHNlbGVjdG9yLCB0YWdOYW1lLCBvcHRzKSB7XG4gICAgdmFyIHRhZ3MgPSBbXTtcbiAgICB2YXIgZWxlbSwgYWxsVGFncztcblxuICAgIGZ1bmN0aW9uIHB1c2hUYWdzVG8ocm9vdCkge1xuICAgICAgaWYgKHJvb3QudGFnTmFtZSkge1xuICAgICAgICB2YXIgcmlvdFRhZyA9IGdldEF0dHJpYnV0ZShyb290LCBJU19ESVJFQ1RJVkUpLCB0YWc7XG5cbiAgICAgICAgLy8gaGF2ZSB0YWdOYW1lPyBmb3JjZSByaW90LXRhZyB0byBiZSB0aGUgc2FtZVxuICAgICAgICBpZiAodGFnTmFtZSAmJiByaW90VGFnICE9PSB0YWdOYW1lKSB7XG4gICAgICAgICAgcmlvdFRhZyA9IHRhZ05hbWU7XG4gICAgICAgICAgc2V0QXR0cmlidXRlKHJvb3QsIElTX0RJUkVDVElWRSwgdGFnTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0YWcgPSBtb3VudCQxKFxuICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgcmlvdFRhZyB8fCByb290LnRhZ05hbWUudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgICBpc0Z1bmN0aW9uKG9wdHMpID8gb3B0cygpIDogb3B0c1xuICAgICAgICApO1xuXG4gICAgICAgIGlmICh0YWcpXG4gICAgICAgICAgeyB0YWdzLnB1c2godGFnKTsgfVxuICAgICAgfSBlbHNlIGlmIChyb290Lmxlbmd0aClcbiAgICAgICAgeyBlYWNoKHJvb3QsIHB1c2hUYWdzVG8pOyB9IC8vIGFzc3VtZSBub2RlTGlzdFxuICAgIH1cblxuICAgIC8vIGluamVjdCBzdHlsZXMgaW50byBET01cbiAgICBzdHlsZU1hbmFnZXIuaW5qZWN0KCk7XG5cbiAgICBpZiAoaXNPYmplY3QodGFnTmFtZSkgfHwgaXNGdW5jdGlvbih0YWdOYW1lKSkge1xuICAgICAgb3B0cyA9IHRhZ05hbWU7XG4gICAgICB0YWdOYW1lID0gMDtcbiAgICB9XG5cbiAgICAvLyBjcmF3bCB0aGUgRE9NIHRvIGZpbmQgdGhlIHRhZ1xuICAgIGlmIChpc1N0cmluZyhzZWxlY3RvcikpIHtcbiAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IgPT09ICcqJyA/XG4gICAgICAgIC8vIHNlbGVjdCBhbGwgcmVnaXN0ZXJlZCB0YWdzXG4gICAgICAgIC8vICYgdGFncyBmb3VuZCB3aXRoIHRoZSByaW90LXRhZyBhdHRyaWJ1dGUgc2V0XG4gICAgICAgIGFsbFRhZ3MgPSBxdWVyeSgpIDpcbiAgICAgICAgLy8gb3IganVzdCB0aGUgb25lcyBuYW1lZCBsaWtlIHRoZSBzZWxlY3RvclxuICAgICAgICBzZWxlY3RvciArIHF1ZXJ5KHNlbGVjdG9yLnNwbGl0KC8sICovKSk7XG5cbiAgICAgIC8vIG1ha2Ugc3VyZSB0byBwYXNzIGFsd2F5cyBhIHNlbGVjdG9yXG4gICAgICAvLyB0byB0aGUgcXVlcnlTZWxlY3RvckFsbCBmdW5jdGlvblxuICAgICAgZWxlbSA9IHNlbGVjdG9yID8gJCQoc2VsZWN0b3IpIDogW107XG4gICAgfVxuICAgIGVsc2VcbiAgICAgIC8vIHByb2JhYmx5IHlvdSBoYXZlIHBhc3NlZCBhbHJlYWR5IGEgdGFnIG9yIGEgTm9kZUxpc3RcbiAgICAgIHsgZWxlbSA9IHNlbGVjdG9yOyB9XG5cbiAgICAvLyBzZWxlY3QgYWxsIHRoZSByZWdpc3RlcmVkIGFuZCBtb3VudCB0aGVtIGluc2lkZSB0aGVpciByb290IGVsZW1lbnRzXG4gICAgaWYgKHRhZ05hbWUgPT09ICcqJykge1xuICAgICAgLy8gZ2V0IGFsbCBjdXN0b20gdGFnc1xuICAgICAgdGFnTmFtZSA9IGFsbFRhZ3MgfHwgcXVlcnkoKTtcbiAgICAgIC8vIGlmIHRoZSByb290IGVscyBpdCdzIGp1c3QgYSBzaW5nbGUgdGFnXG4gICAgICBpZiAoZWxlbS50YWdOYW1lKVxuICAgICAgICB7IGVsZW0gPSAkJCh0YWdOYW1lLCBlbGVtKTsgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIC8vIHNlbGVjdCBhbGwgdGhlIGNoaWxkcmVuIGZvciBhbGwgdGhlIGRpZmZlcmVudCByb290IGVsZW1lbnRzXG4gICAgICAgIHZhciBub2RlTGlzdCA9IFtdO1xuXG4gICAgICAgIGVhY2goZWxlbSwgZnVuY3Rpb24gKF9lbCkgeyByZXR1cm4gbm9kZUxpc3QucHVzaCgkJCh0YWdOYW1lLCBfZWwpKTsgfSk7XG5cbiAgICAgICAgZWxlbSA9IG5vZGVMaXN0O1xuICAgICAgfVxuICAgICAgLy8gZ2V0IHJpZCBvZiB0aGUgdGFnTmFtZVxuICAgICAgdGFnTmFtZSA9IDA7XG4gICAgfVxuXG4gICAgcHVzaFRhZ3NUbyhlbGVtKTtcblxuICAgIHJldHVybiB0YWdzXG4gIH1cblxuICAvLyBDcmVhdGUgYSBtaXhpbiB0aGF0IGNvdWxkIGJlIGdsb2JhbGx5IHNoYXJlZCBhY3Jvc3MgYWxsIHRoZSB0YWdzXG4gIHZhciBtaXhpbnMgPSB7fTtcbiAgdmFyIGdsb2JhbHMgPSBtaXhpbnNbR0xPQkFMX01JWElOXSA9IHt9O1xuICB2YXIgbWl4aW5zX2lkID0gMDtcblxuICAvKipcbiAgICogQ3JlYXRlL1JldHVybiBhIG1peGluIGJ5IGl0cyBuYW1lXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gIG5hbWUgLSBtaXhpbiBuYW1lIChnbG9iYWwgbWl4aW4gaWYgb2JqZWN0KVxuICAgKiBAcGFyYW0gICB7IE9iamVjdCB9ICBtaXggLSBtaXhpbiBsb2dpY1xuICAgKiBAcGFyYW0gICB7IEJvb2xlYW4gfSBnIC0gaXMgZ2xvYmFsP1xuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9ICB0aGUgbWl4aW4gbG9naWNcbiAgICovXG4gIGZ1bmN0aW9uIG1peGluKG5hbWUsIG1peCwgZykge1xuICAgIC8vIFVubmFtZWQgZ2xvYmFsXG4gICAgaWYgKGlzT2JqZWN0KG5hbWUpKSB7XG4gICAgICBtaXhpbigoXCJfX1wiICsgKG1peGluc19pZCsrKSArIFwiX19cIiksIG5hbWUsIHRydWUpO1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdmFyIHN0b3JlID0gZyA/IGdsb2JhbHMgOiBtaXhpbnM7XG5cbiAgICAvLyBHZXR0ZXJcbiAgICBpZiAoIW1peCkge1xuICAgICAgaWYgKGlzVW5kZWZpbmVkKHN0b3JlW25hbWVdKSlcbiAgICAgICAgeyB0aHJvdyBuZXcgRXJyb3IoKFwiVW5yZWdpc3RlcmVkIG1peGluOiBcIiArIG5hbWUpKSB9XG5cbiAgICAgIHJldHVybiBzdG9yZVtuYW1lXVxuICAgIH1cblxuICAgIC8vIFNldHRlclxuICAgIHN0b3JlW25hbWVdID0gaXNGdW5jdGlvbihtaXgpID9cbiAgICAgIGV4dGVuZChtaXgucHJvdG90eXBlLCBzdG9yZVtuYW1lXSB8fCB7fSkgJiYgbWl4IDpcbiAgICAgIGV4dGVuZChzdG9yZVtuYW1lXSB8fCB7fSwgbWl4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgYWxsIHRoZSB0YWdzIGluc3RhbmNlcyBjcmVhdGVkXG4gICAqIEByZXR1cm5zIHsgQXJyYXkgfSBhbGwgdGhlIHRhZ3MgaW5zdGFuY2VzXG4gICAqL1xuICBmdW5jdGlvbiB1cGRhdGUkMSgpIHtcbiAgICByZXR1cm4gZWFjaChfX1RBR1NfQ0FDSEUsIGZ1bmN0aW9uICh0YWcpIHsgcmV0dXJuIHRhZy51cGRhdGUoKTsgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHVucmVnaXN0ZXIobmFtZSkge1xuICAgIHN0eWxlTWFuYWdlci5yZW1vdmUobmFtZSk7XG4gICAgcmV0dXJuIGRlbGV0ZSBfX1RBR19JTVBMW25hbWVdXG4gIH1cblxuICB2YXIgdmVyc2lvbiA9ICd2My4xMy4yJztcblxuICB2YXIgY29yZSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcbiAgICBUYWc6IFRhZyxcbiAgICB0YWc6IHRhZyxcbiAgICB0YWcyOiB0YWcyLFxuICAgIG1vdW50OiBtb3VudCxcbiAgICBtaXhpbjogbWl4aW4sXG4gICAgdXBkYXRlOiB1cGRhdGUkMSxcbiAgICB1bnJlZ2lzdGVyOiB1bnJlZ2lzdGVyLFxuICAgIHZlcnNpb246IHZlcnNpb25cbiAgfSk7XG5cbiAgLyoqXG4gICAqIEFkZCBhIG1peGluIHRvIHRoaXMgdGFnXG4gICAqIEByZXR1cm5zIHsgVGFnIH0gdGhlIGN1cnJlbnQgdGFnIGluc3RhbmNlXG4gICAqL1xuICBmdW5jdGlvbiBjb21wb25lbnRNaXhpbih0YWckJDEpIHtcbiAgICB2YXIgbWl4aW5zID0gW10sIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuICAgIHdoaWxlICggbGVuLS0gPiAwICkgbWl4aW5zWyBsZW4gXSA9IGFyZ3VtZW50c1sgbGVuICsgMSBdO1xuXG4gICAgZWFjaChtaXhpbnMsIGZ1bmN0aW9uIChtaXgpIHtcbiAgICAgIHZhciBpbnN0YW5jZTtcbiAgICAgIHZhciBvYmo7XG4gICAgICB2YXIgcHJvcHMgPSBbXTtcblxuICAgICAgLy8gcHJvcGVydGllcyBibGFja2xpc3RlZCBhbmQgd2lsbCBub3QgYmUgYm91bmQgdG8gdGhlIHRhZyBpbnN0YW5jZVxuICAgICAgdmFyIHByb3BzQmxhY2tsaXN0ID0gWydpbml0JywgJ19fcHJvdG9fXyddO1xuXG4gICAgICBtaXggPSBpc1N0cmluZyhtaXgpID8gbWl4aW4obWl4KSA6IG1peDtcblxuICAgICAgLy8gY2hlY2sgaWYgdGhlIG1peGluIGlzIGEgZnVuY3Rpb25cbiAgICAgIGlmIChpc0Z1bmN0aW9uKG1peCkpIHtcbiAgICAgICAgLy8gY3JlYXRlIHRoZSBuZXcgbWl4aW4gaW5zdGFuY2VcbiAgICAgICAgaW5zdGFuY2UgPSBuZXcgbWl4KCk7XG4gICAgICB9IGVsc2UgeyBpbnN0YW5jZSA9IG1peDsgfVxuXG4gICAgICB2YXIgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoaW5zdGFuY2UpO1xuXG4gICAgICAvLyBidWlsZCBtdWx0aWxldmVsIHByb3RvdHlwZSBpbmhlcml0YW5jZSBjaGFpbiBwcm9wZXJ0eSBsaXN0XG4gICAgICBkbyB7IHByb3BzID0gcHJvcHMuY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaiB8fCBpbnN0YW5jZSkpOyB9XG4gICAgICB3aGlsZSAob2JqID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaiB8fCBpbnN0YW5jZSkpXG5cbiAgICAgIC8vIGxvb3AgdGhlIGtleXMgaW4gdGhlIGZ1bmN0aW9uIHByb3RvdHlwZSBvciB0aGUgYWxsIG9iamVjdCBrZXlzXG4gICAgICBlYWNoKHByb3BzLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIC8vIGJpbmQgbWV0aG9kcyB0byB0YWdcbiAgICAgICAgLy8gYWxsb3cgbWl4aW5zIHRvIG92ZXJyaWRlIG90aGVyIHByb3BlcnRpZXMvcGFyZW50IG1peGluc1xuICAgICAgICBpZiAoIWNvbnRhaW5zKHByb3BzQmxhY2tsaXN0LCBrZXkpKSB7XG4gICAgICAgICAgLy8gY2hlY2sgZm9yIGdldHRlcnMvc2V0dGVyc1xuICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0gZ2V0UHJvcERlc2NyaXB0b3IoaW5zdGFuY2UsIGtleSkgfHwgZ2V0UHJvcERlc2NyaXB0b3IocHJvdG8sIGtleSk7XG4gICAgICAgICAgdmFyIGhhc0dldHRlclNldHRlciA9IGRlc2NyaXB0b3IgJiYgKGRlc2NyaXB0b3IuZ2V0IHx8IGRlc2NyaXB0b3Iuc2V0KTtcblxuICAgICAgICAgIC8vIGFwcGx5IG1ldGhvZCBvbmx5IGlmIGl0IGRvZXMgbm90IGFscmVhZHkgZXhpc3Qgb24gdGhlIGluc3RhbmNlXG4gICAgICAgICAgaWYgKCF0YWckJDEuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBoYXNHZXR0ZXJTZXR0ZXIpIHtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YWckJDEsIGtleSwgZGVzY3JpcHRvcik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhZyQkMVtrZXldID0gaXNGdW5jdGlvbihpbnN0YW5jZVtrZXldKSA/XG4gICAgICAgICAgICAgIGluc3RhbmNlW2tleV0uYmluZCh0YWckJDEpIDpcbiAgICAgICAgICAgICAgaW5zdGFuY2Vba2V5XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBpbml0IG1ldGhvZCB3aWxsIGJlIGNhbGxlZCBhdXRvbWF0aWNhbGx5XG4gICAgICBpZiAoaW5zdGFuY2UuaW5pdClcbiAgICAgICAgeyBpbnN0YW5jZS5pbml0LmJpbmQodGFnJCQxKSh0YWckJDEub3B0cyk7IH1cbiAgICB9KTtcblxuICAgIHJldHVybiB0YWckJDFcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlIHRoZSBwb3NpdGlvbiBvZiBhIGN1c3RvbSB0YWcgaW4gaXRzIHBhcmVudCB0YWdcbiAgICogQHRoaXMgVGFnXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gdGFnTmFtZSAtIGtleSB3aGVyZSB0aGUgdGFnIHdhcyBzdG9yZWRcbiAgICogQHBhcmFtICAgeyBOdW1iZXIgfSBuZXdQb3MgLSBpbmRleCB3aGVyZSB0aGUgbmV3IHRhZyB3aWxsIGJlIHN0b3JlZFxuICAgKi9cbiAgZnVuY3Rpb24gbW92ZUNoaWxkKHRhZ05hbWUsIG5ld1Bvcykge1xuICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICB2YXIgdGFncztcbiAgICAvLyBubyBwYXJlbnQgbm8gbW92ZVxuICAgIGlmICghcGFyZW50KSB7IHJldHVybiB9XG5cbiAgICB0YWdzID0gcGFyZW50LnRhZ3NbdGFnTmFtZV07XG5cbiAgICBpZiAoaXNBcnJheSh0YWdzKSlcbiAgICAgIHsgdGFncy5zcGxpY2UobmV3UG9zLCAwLCB0YWdzLnNwbGljZSh0YWdzLmluZGV4T2YodGhpcyksIDEpWzBdKTsgfVxuICAgIGVsc2UgeyBhcnJheWlzaEFkZChwYXJlbnQudGFncywgdGFnTmFtZSwgdGhpcyk7IH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlIHZpcnR1YWwgdGFnIGFuZCBhbGwgY2hpbGQgbm9kZXNcbiAgICogQHRoaXMgVGFnXG4gICAqIEBwYXJhbSB7IE5vZGUgfSBzcmMgIC0gdGhlIG5vZGUgdGhhdCB3aWxsIGRvIHRoZSBpbnNlcnRpbmdcbiAgICogQHBhcmFtIHsgVGFnIH0gdGFyZ2V0IC0gaW5zZXJ0IGJlZm9yZSB0aGlzIHRhZydzIGZpcnN0IGNoaWxkXG4gICAqL1xuICBmdW5jdGlvbiBtb3ZlVmlydHVhbChzcmMsIHRhcmdldCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgdmFyIGVsID0gdGhpcy5fXy5oZWFkO1xuICAgIHZhciBzaWI7XG4gICAgdmFyIGZyYWcgPSBjcmVhdGVGcmFnbWVudCgpO1xuXG4gICAgd2hpbGUgKGVsKSB7XG4gICAgICBzaWIgPSBlbC5uZXh0U2libGluZztcbiAgICAgIGZyYWcuYXBwZW5kQ2hpbGQoZWwpO1xuICAgICAgZWwgPSBzaWI7XG4gICAgICBpZiAoZWwgPT09IHRoaXMkMS5fXy50YWlsKSB7XG4gICAgICAgIGZyYWcuYXBwZW5kQ2hpbGQoZWwpO1xuICAgICAgICBzcmMuaW5zZXJ0QmVmb3JlKGZyYWcsIHRhcmdldC5fXy5oZWFkKTtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCB0aGUgaXRlbSBsb29wZWQgaW50byBhbiBvYmplY3QgdXNlZCB0byBleHRlbmQgdGhlIGNoaWxkIHRhZyBwcm9wZXJ0aWVzXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZXhwciAtIG9iamVjdCBjb250YWluaW5nIHRoZSBrZXlzIHVzZWQgdG8gZXh0ZW5kIHRoZSBjaGlsZHJlbiB0YWdzXG4gICAqIEBwYXJhbSAgIHsgKiB9IGtleSAtIHZhbHVlIHRvIGFzc2lnbiB0byB0aGUgbmV3IG9iamVjdCByZXR1cm5lZFxuICAgKiBAcGFyYW0gICB7ICogfSB2YWwgLSB2YWx1ZSBjb250YWluaW5nIHRoZSBwb3NpdGlvbiBvZiB0aGUgaXRlbSBpbiB0aGUgYXJyYXlcbiAgICogQHJldHVybnMgeyBPYmplY3QgfSAtIG5ldyBvYmplY3QgY29udGFpbmluZyB0aGUgdmFsdWVzIG9mIHRoZSBvcmlnaW5hbCBpdGVtXG4gICAqXG4gICAqIFRoZSB2YXJpYWJsZXMgJ2tleScgYW5kICd2YWwnIGFyZSBhcmJpdHJhcnkuXG4gICAqIFRoZXkgZGVwZW5kIG9uIHRoZSBjb2xsZWN0aW9uIHR5cGUgbG9vcGVkIChBcnJheSwgT2JqZWN0KVxuICAgKiBhbmQgb24gdGhlIGV4cHJlc3Npb24gdXNlZCBvbiB0aGUgZWFjaCB0YWdcbiAgICpcbiAgICovXG4gIGZ1bmN0aW9uIG1raXRlbShleHByLCBrZXksIHZhbCkge1xuICAgIHZhciBpdGVtID0ge307XG4gICAgaXRlbVtleHByLmtleV0gPSBrZXk7XG4gICAgaWYgKGV4cHIucG9zKSB7IGl0ZW1bZXhwci5wb3NdID0gdmFsOyB9XG4gICAgcmV0dXJuIGl0ZW1cbiAgfVxuXG4gIC8qKlxuICAgKiBVbm1vdW50IHRoZSByZWR1bmRhbnQgdGFnc1xuICAgKiBAcGFyYW0gICB7IEFycmF5IH0gaXRlbXMgLSBhcnJheSBjb250YWluaW5nIHRoZSBjdXJyZW50IGl0ZW1zIHRvIGxvb3BcbiAgICogQHBhcmFtICAgeyBBcnJheSB9IHRhZ3MgLSBhcnJheSBjb250YWluaW5nIGFsbCB0aGUgY2hpbGRyZW4gdGFnc1xuICAgKi9cbiAgZnVuY3Rpb24gdW5tb3VudFJlZHVuZGFudChpdGVtcywgdGFncywgZmlsdGVyZWRJdGVtc0NvdW50KSB7XG4gICAgdmFyIGkgPSB0YWdzLmxlbmd0aDtcbiAgICB2YXIgaiA9IGl0ZW1zLmxlbmd0aCAtIGZpbHRlcmVkSXRlbXNDb3VudDtcblxuICAgIHdoaWxlIChpID4gaikge1xuICAgICAgaS0tO1xuICAgICAgcmVtb3ZlLmFwcGx5KHRhZ3NbaV0sIFt0YWdzLCBpXSk7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogUmVtb3ZlIGEgY2hpbGQgdGFnXG4gICAqIEB0aGlzIFRhZ1xuICAgKiBAcGFyYW0gICB7IEFycmF5IH0gdGFncyAtIHRhZ3MgY29sbGVjdGlvblxuICAgKiBAcGFyYW0gICB7IE51bWJlciB9IGkgLSBpbmRleCBvZiB0aGUgdGFnIHRvIHJlbW92ZVxuICAgKi9cbiAgZnVuY3Rpb24gcmVtb3ZlKHRhZ3MsIGkpIHtcbiAgICB0YWdzLnNwbGljZShpLCAxKTtcbiAgICB0aGlzLnVubW91bnQoKTtcbiAgICBhcnJheWlzaFJlbW92ZSh0aGlzLnBhcmVudCwgdGhpcywgdGhpcy5fXy50YWdOYW1lLCB0cnVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlIHRoZSBuZXN0ZWQgY3VzdG9tIHRhZ3MgaW4gbm9uIGN1c3RvbSBsb29wIHRhZ3NcbiAgICogQHRoaXMgVGFnXG4gICAqIEBwYXJhbSAgIHsgTnVtYmVyIH0gaSAtIGN1cnJlbnQgcG9zaXRpb24gb2YgdGhlIGxvb3AgdGFnXG4gICAqL1xuICBmdW5jdGlvbiBtb3ZlTmVzdGVkVGFncyhpKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICBlYWNoKE9iamVjdC5rZXlzKHRoaXMudGFncyksIGZ1bmN0aW9uICh0YWdOYW1lKSB7XG4gICAgICBtb3ZlQ2hpbGQuYXBwbHkodGhpcyQxLnRhZ3NbdGFnTmFtZV0sIFt0YWdOYW1lLCBpXSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTW92ZSBhIGNoaWxkIHRhZ1xuICAgKiBAdGhpcyBUYWdcbiAgICogQHBhcmFtICAgeyBIVE1MRWxlbWVudCB9IHJvb3QgLSBkb20gbm9kZSBjb250YWluaW5nIGFsbCB0aGUgbG9vcCBjaGlsZHJlblxuICAgKiBAcGFyYW0gICB7IFRhZyB9IG5leHRUYWcgLSBpbnN0YW5jZSBvZiB0aGUgbmV4dCB0YWcgcHJlY2VkaW5nIHRoZSBvbmUgd2Ugd2FudCB0byBtb3ZlXG4gICAqIEBwYXJhbSAgIHsgQm9vbGVhbiB9IGlzVmlydHVhbCAtIGlzIGl0IGEgdmlydHVhbCB0YWc/XG4gICAqL1xuICBmdW5jdGlvbiBtb3ZlKHJvb3QsIG5leHRUYWcsIGlzVmlydHVhbCkge1xuICAgIGlmIChpc1ZpcnR1YWwpXG4gICAgICB7IG1vdmVWaXJ0dWFsLmFwcGx5KHRoaXMsIFtyb290LCBuZXh0VGFnXSk7IH1cbiAgICBlbHNlXG4gICAgICB7IHNhZmVJbnNlcnQocm9vdCwgdGhpcy5yb290LCBuZXh0VGFnLnJvb3QpOyB9XG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0IGFuZCBtb3VudCBhIGNoaWxkIHRhZ1xuICAgKiBAdGhpcyBUYWdcbiAgICogQHBhcmFtICAgeyBIVE1MRWxlbWVudCB9IHJvb3QgLSBkb20gbm9kZSBjb250YWluaW5nIGFsbCB0aGUgbG9vcCBjaGlsZHJlblxuICAgKiBAcGFyYW0gICB7IFRhZyB9IG5leHRUYWcgLSBpbnN0YW5jZSBvZiB0aGUgbmV4dCB0YWcgcHJlY2VkaW5nIHRoZSBvbmUgd2Ugd2FudCB0byBpbnNlcnRcbiAgICogQHBhcmFtICAgeyBCb29sZWFuIH0gaXNWaXJ0dWFsIC0gaXMgaXQgYSB2aXJ0dWFsIHRhZz9cbiAgICovXG4gIGZ1bmN0aW9uIGluc2VydChyb290LCBuZXh0VGFnLCBpc1ZpcnR1YWwpIHtcbiAgICBpZiAoaXNWaXJ0dWFsKVxuICAgICAgeyBtYWtlVmlydHVhbC5hcHBseSh0aGlzLCBbcm9vdCwgbmV4dFRhZ10pOyB9XG4gICAgZWxzZVxuICAgICAgeyBzYWZlSW5zZXJ0KHJvb3QsIHRoaXMucm9vdCwgbmV4dFRhZy5yb290KTsgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZCBhIG5ldyB0YWcgaW50byB0aGUgRE9NXG4gICAqIEB0aGlzIFRhZ1xuICAgKiBAcGFyYW0gICB7IEhUTUxFbGVtZW50IH0gcm9vdCAtIGRvbSBub2RlIGNvbnRhaW5pbmcgYWxsIHRoZSBsb29wIGNoaWxkcmVuXG4gICAqIEBwYXJhbSAgIHsgQm9vbGVhbiB9IGlzVmlydHVhbCAtIGlzIGl0IGEgdmlydHVhbCB0YWc/XG4gICAqL1xuICBmdW5jdGlvbiBhcHBlbmQocm9vdCwgaXNWaXJ0dWFsKSB7XG4gICAgaWYgKGlzVmlydHVhbClcbiAgICAgIHsgbWFrZVZpcnR1YWwuY2FsbCh0aGlzLCByb290KTsgfVxuICAgIGVsc2VcbiAgICAgIHsgcm9vdC5hcHBlbmRDaGlsZCh0aGlzLnJvb3QpOyB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSB2YWx1ZSB3ZSB3YW50IHRvIHVzZSB0byBsb29rdXAgdGhlIHBvc3Rpb24gb2Ygb3VyIGl0ZW1zIGluIHRoZSBjb2xsZWN0aW9uXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gIGtleUF0dHIgICAgICAgICAtIGxvb2t1cCBzdHJpbmcgb3IgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gICB7ICogfSAgICAgICBvcmlnaW5hbEl0ZW0gICAgLSBvcmlnaW5hbCBpdGVtIGZyb20gdGhlIGNvbGxlY3Rpb25cbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSAga2V5ZWRJdGVtICAgICAgIC0gb2JqZWN0IGNyZWF0ZWQgYnkgcmlvdCB2aWEgeyBpdGVtLCBpIGluIGNvbGxlY3Rpb24gfVxuICAgKiBAcGFyYW0gICB7IEJvb2xlYW4gfSBoYXNLZXlBdHRyRXhwciAgLSBmbGFnIHRvIGNoZWNrIHdoZXRoZXIgdGhlIGtleSBpcyBhbiBleHByZXNzaW9uXG4gICAqIEByZXR1cm5zIHsgKiB9IHZhbHVlIHRoYXQgd2Ugd2lsbCB1c2UgdG8gZmlndXJlIG91dCB0aGUgaXRlbSBwb3NpdGlvbiB2aWEgY29sbGVjdGlvbi5pbmRleE9mXG4gICAqL1xuICBmdW5jdGlvbiBnZXRJdGVtSWQoa2V5QXR0ciwgb3JpZ2luYWxJdGVtLCBrZXllZEl0ZW0sIGhhc0tleUF0dHJFeHByKSB7XG4gICAgaWYgKGtleUF0dHIpIHtcbiAgICAgIHJldHVybiBoYXNLZXlBdHRyRXhwciA/ICB0bXBsKGtleUF0dHIsIGtleWVkSXRlbSkgOiAgb3JpZ2luYWxJdGVtW2tleUF0dHJdXG4gICAgfVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsSXRlbVxuICB9XG5cbiAgLyoqXG4gICAqIE1hbmFnZSB0YWdzIGhhdmluZyB0aGUgJ2VhY2gnXG4gICAqIEBwYXJhbSAgIHsgSFRNTEVsZW1lbnQgfSBkb20gLSBET00gbm9kZSB3ZSBuZWVkIHRvIGxvb3BcbiAgICogQHBhcmFtICAgeyBUYWcgfSBwYXJlbnQgLSBwYXJlbnQgdGFnIGluc3RhbmNlIHdoZXJlIHRoZSBkb20gbm9kZSBpcyBjb250YWluZWRcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSBleHByIC0gc3RyaW5nIGNvbnRhaW5lZCBpbiB0aGUgJ2VhY2gnIGF0dHJpYnV0ZVxuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IGV4cHJlc3Npb24gb2JqZWN0IGZvciB0aGlzIGVhY2ggbG9vcFxuICAgKi9cbiAgZnVuY3Rpb24gX2VhY2goZG9tLCBwYXJlbnQsIGV4cHIpIHtcbiAgICB2YXIgbXVzdFJlb3JkZXIgPSB0eXBlb2YgZ2V0QXR0cmlidXRlKGRvbSwgTE9PUF9OT19SRU9SREVSX0RJUkVDVElWRSkgIT09IFRfU1RSSU5HIHx8IHJlbW92ZUF0dHJpYnV0ZShkb20sIExPT1BfTk9fUkVPUkRFUl9ESVJFQ1RJVkUpO1xuICAgIHZhciBrZXlBdHRyID0gZ2V0QXR0cmlidXRlKGRvbSwgS0VZX0RJUkVDVElWRSk7XG4gICAgdmFyIGhhc0tleUF0dHJFeHByID0ga2V5QXR0ciA/IHRtcGwuaGFzRXhwcihrZXlBdHRyKSA6IGZhbHNlO1xuICAgIHZhciB0YWdOYW1lID0gZ2V0TmFtZShkb20pO1xuICAgIHZhciBpbXBsID0gX19UQUdfSU1QTFt0YWdOYW1lXTtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbS5wYXJlbnROb2RlO1xuICAgIHZhciBwbGFjZWhvbGRlciA9IGNyZWF0ZURPTVBsYWNlaG9sZGVyKCk7XG4gICAgdmFyIGNoaWxkID0gZ2V0KGRvbSk7XG4gICAgdmFyIGlmRXhwciA9IGdldEF0dHJpYnV0ZShkb20sIENPTkRJVElPTkFMX0RJUkVDVElWRSk7XG4gICAgdmFyIHRhZ3MgPSBbXTtcbiAgICB2YXIgaXNMb29wID0gdHJ1ZTtcbiAgICB2YXIgaW5uZXJIVE1MID0gZG9tLmlubmVySFRNTDtcbiAgICB2YXIgaXNBbm9ueW1vdXMgPSAhX19UQUdfSU1QTFt0YWdOYW1lXTtcbiAgICB2YXIgaXNWaXJ0dWFsID0gZG9tLnRhZ05hbWUgPT09ICdWSVJUVUFMJztcbiAgICB2YXIgb2xkSXRlbXMgPSBbXTtcblxuICAgIC8vIHJlbW92ZSB0aGUgZWFjaCBwcm9wZXJ0eSBmcm9tIHRoZSBvcmlnaW5hbCB0YWdcbiAgICByZW1vdmVBdHRyaWJ1dGUoZG9tLCBMT09QX0RJUkVDVElWRSk7XG4gICAgcmVtb3ZlQXR0cmlidXRlKGRvbSwgS0VZX0RJUkVDVElWRSk7XG5cbiAgICAvLyBwYXJzZSB0aGUgZWFjaCBleHByZXNzaW9uXG4gICAgZXhwciA9IHRtcGwubG9vcEtleXMoZXhwcik7XG4gICAgZXhwci5pc0xvb3AgPSB0cnVlO1xuXG4gICAgaWYgKGlmRXhwcikgeyByZW1vdmVBdHRyaWJ1dGUoZG9tLCBDT05ESVRJT05BTF9ESVJFQ1RJVkUpOyB9XG5cbiAgICAvLyBpbnNlcnQgYSBtYXJrZWQgd2hlcmUgdGhlIGxvb3AgdGFncyB3aWxsIGJlIGluamVjdGVkXG4gICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocGxhY2Vob2xkZXIsIGRvbSk7XG4gICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkb20pO1xuXG4gICAgZXhwci51cGRhdGUgPSBmdW5jdGlvbiB1cGRhdGVFYWNoKCkge1xuICAgICAgLy8gZ2V0IHRoZSBuZXcgaXRlbXMgY29sbGVjdGlvblxuICAgICAgZXhwci52YWx1ZSA9IHRtcGwoZXhwci52YWwsIHBhcmVudCk7XG5cbiAgICAgIHZhciBpdGVtcyA9IGV4cHIudmFsdWU7XG4gICAgICB2YXIgZnJhZyA9IGNyZWF0ZUZyYWdtZW50KCk7XG4gICAgICB2YXIgaXNPYmplY3QgPSAhaXNBcnJheShpdGVtcykgJiYgIWlzU3RyaW5nKGl0ZW1zKTtcbiAgICAgIHZhciByb290ID0gcGxhY2Vob2xkZXIucGFyZW50Tm9kZTtcbiAgICAgIHZhciB0bXBJdGVtcyA9IFtdO1xuICAgICAgdmFyIGhhc0tleXMgPSBpc09iamVjdCAmJiAhIWl0ZW1zO1xuXG4gICAgICAvLyBpZiB0aGlzIERPTSB3YXMgcmVtb3ZlZCB0aGUgdXBkYXRlIGhlcmUgaXMgdXNlbGVzc1xuICAgICAgLy8gdGhpcyBjb25kaXRpb24gZml4ZXMgYWxzbyBhIHdlaXJkIGFzeW5jIGlzc3VlIG9uIElFIGluIG91ciB1bml0IHRlc3RcbiAgICAgIGlmICghcm9vdCkgeyByZXR1cm4gfVxuXG4gICAgICAvLyBvYmplY3QgbG9vcC4gYW55IGNoYW5nZXMgY2F1c2UgZnVsbCByZWRyYXdcbiAgICAgIGlmIChpc09iamVjdCkge1xuICAgICAgICBpdGVtcyA9IGl0ZW1zID8gT2JqZWN0LmtleXMoaXRlbXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7IHJldHVybiBta2l0ZW0oZXhwciwgaXRlbXNba2V5XSwga2V5KTsgfSkgOiBbXTtcbiAgICAgIH1cblxuICAgICAgLy8gc3RvcmUgdGhlIGFtb3VudCBvZiBmaWx0ZXJlZCBpdGVtc1xuICAgICAgdmFyIGZpbHRlcmVkSXRlbXNDb3VudCA9IDA7XG5cbiAgICAgIC8vIGxvb3AgYWxsIHRoZSBuZXcgaXRlbXNcbiAgICAgIGVhY2goaXRlbXMsIGZ1bmN0aW9uIChfaXRlbSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIGkgPSBpbmRleCAtIGZpbHRlcmVkSXRlbXNDb3VudDtcbiAgICAgICAgdmFyIGl0ZW0gPSAhaGFzS2V5cyAmJiBleHByLmtleSA/IG1raXRlbShleHByLCBfaXRlbSwgaW5kZXgpIDogX2l0ZW07XG5cbiAgICAgICAgLy8gc2tpcCB0aGlzIGl0ZW0gYmVjYXVzZSBpdCBtdXN0IGJlIGZpbHRlcmVkXG4gICAgICAgIGlmIChpZkV4cHIgJiYgIXRtcGwoaWZFeHByLCBleHRlbmQoY3JlYXRlKHBhcmVudCksIGl0ZW0pKSkge1xuICAgICAgICAgIGZpbHRlcmVkSXRlbXNDb3VudCArKztcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpdGVtSWQgPSBnZXRJdGVtSWQoa2V5QXR0ciwgX2l0ZW0sIGl0ZW0sIGhhc0tleUF0dHJFeHByKTtcbiAgICAgICAgLy8gcmVvcmRlciBvbmx5IGlmIHRoZSBpdGVtcyBhcmUgbm90IG9iamVjdHNcbiAgICAgICAgLy8gb3IgYSBrZXkgYXR0cmlidXRlIGhhcyBiZWVuIHByb3ZpZGVkXG4gICAgICAgIHZhciBkb1Jlb3JkZXIgPSAhaXNPYmplY3QgJiYgbXVzdFJlb3JkZXIgJiYgdHlwZW9mIF9pdGVtID09PSBUX09CSkVDVCB8fCBrZXlBdHRyO1xuICAgICAgICB2YXIgb2xkUG9zID0gb2xkSXRlbXMuaW5kZXhPZihpdGVtSWQpO1xuICAgICAgICB2YXIgaXNOZXcgPSBvbGRQb3MgPT09IC0xO1xuICAgICAgICB2YXIgcG9zID0gIWlzTmV3ICYmIGRvUmVvcmRlciA/IG9sZFBvcyA6IGk7XG4gICAgICAgIC8vIGRvZXMgYSB0YWcgZXhpc3QgaW4gdGhpcyBwb3NpdGlvbj9cbiAgICAgICAgdmFyIHRhZyA9IHRhZ3NbcG9zXTtcbiAgICAgICAgdmFyIG11c3RBcHBlbmQgPSBpID49IG9sZEl0ZW1zLmxlbmd0aDtcbiAgICAgICAgdmFyIG11c3RDcmVhdGUgPSBkb1Jlb3JkZXIgJiYgaXNOZXcgfHwgIWRvUmVvcmRlciAmJiAhdGFnIHx8ICF0YWdzW2ldO1xuXG4gICAgICAgIC8vIG5ldyB0YWdcbiAgICAgICAgaWYgKG11c3RDcmVhdGUpIHtcbiAgICAgICAgICB0YWcgPSBjcmVhdGVUYWcoaW1wbCwge1xuICAgICAgICAgICAgcGFyZW50OiBwYXJlbnQsXG4gICAgICAgICAgICBpc0xvb3A6IGlzTG9vcCxcbiAgICAgICAgICAgIGlzQW5vbnltb3VzOiBpc0Fub255bW91cyxcbiAgICAgICAgICAgIHRhZ05hbWU6IHRhZ05hbWUsXG4gICAgICAgICAgICByb290OiBkb20uY2xvbmVOb2RlKGlzQW5vbnltb3VzKSxcbiAgICAgICAgICAgIGl0ZW06IGl0ZW0sXG4gICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICB9LCBpbm5lckhUTUwpO1xuXG4gICAgICAgICAgLy8gbW91bnQgdGhlIHRhZ1xuICAgICAgICAgIHRhZy5tb3VudCgpO1xuXG4gICAgICAgICAgaWYgKG11c3RBcHBlbmQpXG4gICAgICAgICAgICB7IGFwcGVuZC5hcHBseSh0YWcsIFtmcmFnIHx8IHJvb3QsIGlzVmlydHVhbF0pOyB9XG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgeyBpbnNlcnQuYXBwbHkodGFnLCBbcm9vdCwgdGFnc1tpXSwgaXNWaXJ0dWFsXSk7IH1cblxuICAgICAgICAgIGlmICghbXVzdEFwcGVuZCkgeyBvbGRJdGVtcy5zcGxpY2UoaSwgMCwgaXRlbSk7IH1cbiAgICAgICAgICB0YWdzLnNwbGljZShpLCAwLCB0YWcpO1xuICAgICAgICAgIGlmIChjaGlsZCkgeyBhcnJheWlzaEFkZChwYXJlbnQudGFncywgdGFnTmFtZSwgdGFnLCB0cnVlKTsgfVxuICAgICAgICB9IGVsc2UgaWYgKHBvcyAhPT0gaSAmJiBkb1Jlb3JkZXIpIHtcbiAgICAgICAgICAvLyBtb3ZlXG4gICAgICAgICAgaWYgKGtleUF0dHIgfHwgY29udGFpbnMoaXRlbXMsIG9sZEl0ZW1zW3Bvc10pKSB7XG4gICAgICAgICAgICBtb3ZlLmFwcGx5KHRhZywgW3Jvb3QsIHRhZ3NbaV0sIGlzVmlydHVhbF0pO1xuICAgICAgICAgICAgLy8gbW92ZSB0aGUgb2xkIHRhZyBpbnN0YW5jZVxuICAgICAgICAgICAgdGFncy5zcGxpY2UoaSwgMCwgdGFncy5zcGxpY2UocG9zLCAxKVswXSk7XG4gICAgICAgICAgICAvLyBtb3ZlIHRoZSBvbGQgaXRlbVxuICAgICAgICAgICAgb2xkSXRlbXMuc3BsaWNlKGksIDAsIG9sZEl0ZW1zLnNwbGljZShwb3MsIDEpWzBdKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyB1cGRhdGUgdGhlIHBvc2l0aW9uIGF0dHJpYnV0ZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICBpZiAoZXhwci5wb3MpIHsgdGFnW2V4cHIucG9zXSA9IGk7IH1cblxuICAgICAgICAgIC8vIGlmIHRoZSBsb29wIHRhZ3MgYXJlIG5vdCBjdXN0b21cbiAgICAgICAgICAvLyB3ZSBuZWVkIHRvIG1vdmUgYWxsIHRoZWlyIGN1c3RvbSB0YWdzIGludG8gdGhlIHJpZ2h0IHBvc2l0aW9uXG4gICAgICAgICAgaWYgKCFjaGlsZCAmJiB0YWcudGFncykgeyBtb3ZlTmVzdGVkVGFncy5jYWxsKHRhZywgaSk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNhY2hlIHRoZSBvcmlnaW5hbCBpdGVtIHRvIHVzZSBpdCBpbiB0aGUgZXZlbnRzIGJvdW5kIHRvIHRoaXMgbm9kZVxuICAgICAgICAvLyBhbmQgaXRzIGNoaWxkcmVuXG4gICAgICAgIGV4dGVuZCh0YWcuX18sIHtcbiAgICAgICAgICBpdGVtOiBpdGVtLFxuICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgIHBhcmVudDogcGFyZW50XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRtcEl0ZW1zW2ldID0gaXRlbUlkO1xuXG4gICAgICAgIGlmICghbXVzdENyZWF0ZSkgeyB0YWcudXBkYXRlKGl0ZW0pOyB9XG4gICAgICB9KTtcblxuICAgICAgLy8gcmVtb3ZlIHRoZSByZWR1bmRhbnQgdGFnc1xuICAgICAgdW5tb3VudFJlZHVuZGFudChpdGVtcywgdGFncywgZmlsdGVyZWRJdGVtc0NvdW50KTtcblxuICAgICAgLy8gY2xvbmUgdGhlIGl0ZW1zIGFycmF5XG4gICAgICBvbGRJdGVtcyA9IHRtcEl0ZW1zLnNsaWNlKCk7XG5cbiAgICAgIHJvb3QuaW5zZXJ0QmVmb3JlKGZyYWcsIHBsYWNlaG9sZGVyKTtcbiAgICB9O1xuXG4gICAgZXhwci51bm1vdW50ID0gZnVuY3Rpb24gKCkge1xuICAgICAgZWFjaCh0YWdzLCBmdW5jdGlvbiAodCkgeyB0LnVubW91bnQoKTsgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBleHByXG4gIH1cblxuICB2YXIgUmVmRXhwciA9IHtcbiAgICBpbml0OiBmdW5jdGlvbiBpbml0KGRvbSwgcGFyZW50LCBhdHRyTmFtZSwgYXR0clZhbHVlKSB7XG4gICAgICB0aGlzLmRvbSA9IGRvbTtcbiAgICAgIHRoaXMuYXR0ciA9IGF0dHJOYW1lO1xuICAgICAgdGhpcy5yYXdWYWx1ZSA9IGF0dHJWYWx1ZTtcbiAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgdGhpcy5oYXNFeHAgPSB0bXBsLmhhc0V4cHIoYXR0clZhbHVlKTtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSgpIHtcbiAgICAgIHZhciBvbGQgPSB0aGlzLnZhbHVlO1xuICAgICAgdmFyIGN1c3RvbVBhcmVudCA9IHRoaXMucGFyZW50ICYmIGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudCh0aGlzLnBhcmVudCk7XG4gICAgICAvLyBpZiB0aGUgcmVmZXJlbmNlZCBlbGVtZW50IGlzIGEgY3VzdG9tIHRhZywgdGhlbiB3ZSBzZXQgdGhlIHRhZyBpdHNlbGYsIHJhdGhlciB0aGFuIERPTVxuICAgICAgdmFyIHRhZ09yRG9tID0gdGhpcy5kb20uX19yZWYgfHwgdGhpcy50YWcgfHwgdGhpcy5kb207XG5cbiAgICAgIHRoaXMudmFsdWUgPSB0aGlzLmhhc0V4cCA/IHRtcGwodGhpcy5yYXdWYWx1ZSwgdGhpcy5wYXJlbnQpIDogdGhpcy5yYXdWYWx1ZTtcblxuICAgICAgLy8gdGhlIG5hbWUgY2hhbmdlZCwgc28gd2UgbmVlZCB0byByZW1vdmUgaXQgZnJvbSB0aGUgb2xkIGtleSAoaWYgcHJlc2VudClcbiAgICAgIGlmICghaXNCbGFuayhvbGQpICYmIGN1c3RvbVBhcmVudCkgeyBhcnJheWlzaFJlbW92ZShjdXN0b21QYXJlbnQucmVmcywgb2xkLCB0YWdPckRvbSk7IH1cbiAgICAgIGlmICghaXNCbGFuayh0aGlzLnZhbHVlKSAmJiBpc1N0cmluZyh0aGlzLnZhbHVlKSkge1xuICAgICAgICAvLyBhZGQgaXQgdG8gdGhlIHJlZnMgb2YgcGFyZW50IHRhZyAodGhpcyBiZWhhdmlvciB3YXMgY2hhbmdlZCA+PTMuMClcbiAgICAgICAgaWYgKGN1c3RvbVBhcmVudCkgeyBhcnJheWlzaEFkZChcbiAgICAgICAgICBjdXN0b21QYXJlbnQucmVmcyxcbiAgICAgICAgICB0aGlzLnZhbHVlLFxuICAgICAgICAgIHRhZ09yRG9tLFxuICAgICAgICAgIC8vIHVzZSBhbiBhcnJheSBpZiBpdCdzIGEgbG9vcGVkIG5vZGUgYW5kIHRoZSByZWYgaXMgbm90IGFuIGV4cHJlc3Npb25cbiAgICAgICAgICBudWxsLFxuICAgICAgICAgIHRoaXMucGFyZW50Ll9fLmluZGV4XG4gICAgICAgICk7IH1cblxuICAgICAgICBpZiAodGhpcy52YWx1ZSAhPT0gb2xkKSB7XG4gICAgICAgICAgc2V0QXR0cmlidXRlKHRoaXMuZG9tLCB0aGlzLmF0dHIsIHRoaXMudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVBdHRyaWJ1dGUodGhpcy5kb20sIHRoaXMuYXR0cik7XG4gICAgICB9XG5cbiAgICAgIC8vIGNhY2hlIHRoZSByZWYgYm91bmQgdG8gdGhpcyBkb20gbm9kZVxuICAgICAgLy8gdG8gcmV1c2UgaXQgaW4gZnV0dXJlIChzZWUgYWxzbyAjMjMyOSlcbiAgICAgIGlmICghdGhpcy5kb20uX19yZWYpIHsgdGhpcy5kb20uX19yZWYgPSB0YWdPckRvbTsgfVxuICAgIH0sXG4gICAgdW5tb3VudDogZnVuY3Rpb24gdW5tb3VudCgpIHtcbiAgICAgIHZhciB0YWdPckRvbSA9IHRoaXMudGFnIHx8IHRoaXMuZG9tO1xuICAgICAgdmFyIGN1c3RvbVBhcmVudCA9IHRoaXMucGFyZW50ICYmIGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudCh0aGlzLnBhcmVudCk7XG4gICAgICBpZiAoIWlzQmxhbmsodGhpcy52YWx1ZSkgJiYgY3VzdG9tUGFyZW50KVxuICAgICAgICB7IGFycmF5aXNoUmVtb3ZlKGN1c3RvbVBhcmVudC5yZWZzLCB0aGlzLnZhbHVlLCB0YWdPckRvbSk7IH1cbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyByZWYgZGlyZWN0aXZlXG4gICAqIEBwYXJhbSAgIHsgSFRNTEVsZW1lbnQgfSBkb20gLSBkb20gbm9kZSBoYXZpbmcgdGhlIHJlZiBhdHRyaWJ1dGVcbiAgICogQHBhcmFtICAgeyBUYWcgfSBjb250ZXh0IC0gdGFnIGluc3RhbmNlIHdoZXJlIHRoZSBET00gbm9kZSBpcyBsb2NhdGVkXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gYXR0ck5hbWUgLSBlaXRoZXIgJ3JlZicgb3IgJ2RhdGEtcmVmJ1xuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGF0dHJWYWx1ZSAtIHZhbHVlIG9mIHRoZSByZWYgYXR0cmlidXRlXG4gICAqIEByZXR1cm5zIHsgUmVmRXhwciB9IGEgbmV3IFJlZkV4cHIgb2JqZWN0XG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVSZWZEaXJlY3RpdmUoZG9tLCB0YWcsIGF0dHJOYW1lLCBhdHRyVmFsdWUpIHtcbiAgICByZXR1cm4gY3JlYXRlKFJlZkV4cHIpLmluaXQoZG9tLCB0YWcsIGF0dHJOYW1lLCBhdHRyVmFsdWUpXG4gIH1cblxuICAvKipcbiAgICogVHJpZ2dlciB0aGUgdW5tb3VudCBtZXRob2Qgb24gYWxsIHRoZSBleHByZXNzaW9uc1xuICAgKiBAcGFyYW0gICB7IEFycmF5IH0gZXhwcmVzc2lvbnMgLSBET00gZXhwcmVzc2lvbnNcbiAgICovXG4gIGZ1bmN0aW9uIHVubW91bnRBbGwoZXhwcmVzc2lvbnMpIHtcbiAgICBlYWNoKGV4cHJlc3Npb25zLCBmdW5jdGlvbiAoZXhwcikge1xuICAgICAgaWYgKGV4cHIudW5tb3VudCkgeyBleHByLnVubW91bnQodHJ1ZSk7IH1cbiAgICAgIGVsc2UgaWYgKGV4cHIudGFnTmFtZSkgeyBleHByLnRhZy51bm1vdW50KHRydWUpOyB9XG4gICAgICBlbHNlIGlmIChleHByLnVubW91bnQpIHsgZXhwci51bm1vdW50KCk7IH1cbiAgICB9KTtcbiAgfVxuXG4gIHZhciBJZkV4cHIgPSB7XG4gICAgaW5pdDogZnVuY3Rpb24gaW5pdChkb20sIHRhZywgZXhwcikge1xuICAgICAgcmVtb3ZlQXR0cmlidXRlKGRvbSwgQ09ORElUSU9OQUxfRElSRUNUSVZFKTtcbiAgICAgIGV4dGVuZCh0aGlzLCB7IHRhZzogdGFnLCBleHByOiBleHByLCBzdHViOiBjcmVhdGVET01QbGFjZWhvbGRlcigpLCBwcmlzdGluZTogZG9tIH0pO1xuICAgICAgdmFyIHAgPSBkb20ucGFyZW50Tm9kZTtcbiAgICAgIHAuaW5zZXJ0QmVmb3JlKHRoaXMuc3R1YiwgZG9tKTtcbiAgICAgIHAucmVtb3ZlQ2hpbGQoZG9tKTtcblxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuICAgIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlJCQxKCkge1xuICAgICAgdGhpcy52YWx1ZSA9IHRtcGwodGhpcy5leHByLCB0aGlzLnRhZyk7XG5cbiAgICAgIGlmICghdGhpcy5zdHViLnBhcmVudE5vZGUpIHsgcmV0dXJuIH1cblxuICAgICAgaWYgKHRoaXMudmFsdWUgJiYgIXRoaXMuY3VycmVudCkgeyAvLyBpbnNlcnRcbiAgICAgICAgdGhpcy5jdXJyZW50ID0gdGhpcy5wcmlzdGluZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuc3R1Yi5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh0aGlzLmN1cnJlbnQsIHRoaXMuc3R1Yik7XG4gICAgICAgIHRoaXMuZXhwcmVzc2lvbnMgPSBwYXJzZUV4cHJlc3Npb25zLmFwcGx5KHRoaXMudGFnLCBbdGhpcy5jdXJyZW50LCB0cnVlXSk7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnZhbHVlICYmIHRoaXMuY3VycmVudCkgeyAvLyByZW1vdmVcbiAgICAgICAgdGhpcy51bm1vdW50KCk7XG4gICAgICAgIHRoaXMuY3VycmVudCA9IG51bGw7XG4gICAgICAgIHRoaXMuZXhwcmVzc2lvbnMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudmFsdWUpIHsgdXBkYXRlLmNhbGwodGhpcy50YWcsIHRoaXMuZXhwcmVzc2lvbnMpOyB9XG4gICAgfSxcbiAgICB1bm1vdW50OiBmdW5jdGlvbiB1bm1vdW50KCkge1xuICAgICAgaWYgKHRoaXMuY3VycmVudCkge1xuICAgICAgICBpZiAodGhpcy5jdXJyZW50Ll90YWcpIHtcbiAgICAgICAgICB0aGlzLmN1cnJlbnQuX3RhZy51bm1vdW50KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5jdXJyZW50LnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0aGlzLmN1cnJlbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmN1cnJlbnQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHVubW91bnRBbGwodGhpcy5leHByZXNzaW9ucyB8fCBbXSk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgaWYgZGlyZWN0aXZlXG4gICAqIEBwYXJhbSAgIHsgSFRNTEVsZW1lbnQgfSBkb20gLSBpZiByb290IGRvbSBub2RlXG4gICAqIEBwYXJhbSAgIHsgVGFnIH0gY29udGV4dCAtIHRhZyBpbnN0YW5jZSB3aGVyZSB0aGUgRE9NIG5vZGUgaXMgbG9jYXRlZFxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGF0dHIgLSBpZiBleHByZXNzaW9uXG4gICAqIEByZXR1cm5zIHsgSUZFeHByIH0gYSBuZXcgSWZFeHByIG9iamVjdFxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlSWZEaXJlY3RpdmUoZG9tLCB0YWcsIGF0dHIpIHtcbiAgICByZXR1cm4gY3JlYXRlKElmRXhwcikuaW5pdChkb20sIHRhZywgYXR0cilcbiAgfVxuXG4gIC8qKlxuICAgKiBXYWxrIHRoZSB0YWcgRE9NIHRvIGRldGVjdCB0aGUgZXhwcmVzc2lvbnMgdG8gZXZhbHVhdGVcbiAgICogQHRoaXMgVGFnXG4gICAqIEBwYXJhbSAgIHsgSFRNTEVsZW1lbnQgfSByb290IC0gcm9vdCB0YWcgd2hlcmUgd2Ugd2lsbCBzdGFydCBkaWdnaW5nIHRoZSBleHByZXNzaW9uc1xuICAgKiBAcGFyYW0gICB7IEJvb2xlYW4gfSBtdXN0SW5jbHVkZVJvb3QgLSBmbGFnIHRvIGRlY2lkZSB3aGV0aGVyIHRoZSByb290IG11c3QgYmUgcGFyc2VkIGFzIHdlbGxcbiAgICogQHJldHVybnMgeyBBcnJheSB9IGFsbCB0aGUgZXhwcmVzc2lvbnMgZm91bmRcbiAgICovXG4gIGZ1bmN0aW9uIHBhcnNlRXhwcmVzc2lvbnMocm9vdCwgbXVzdEluY2x1ZGVSb290KSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICB2YXIgZXhwcmVzc2lvbnMgPSBbXTtcblxuICAgIHdhbGtOb2Rlcyhyb290LCBmdW5jdGlvbiAoZG9tKSB7XG4gICAgICB2YXIgdHlwZSA9IGRvbS5ub2RlVHlwZTtcbiAgICAgIHZhciBhdHRyO1xuICAgICAgdmFyIHRhZ0ltcGw7XG5cbiAgICAgIGlmICghbXVzdEluY2x1ZGVSb290ICYmIGRvbSA9PT0gcm9vdCkgeyByZXR1cm4gfVxuXG4gICAgICAvLyB0ZXh0IG5vZGVcbiAgICAgIGlmICh0eXBlID09PSAzICYmIGRvbS5wYXJlbnROb2RlLnRhZ05hbWUgIT09ICdTVFlMRScgJiYgdG1wbC5oYXNFeHByKGRvbS5ub2RlVmFsdWUpKVxuICAgICAgICB7IGV4cHJlc3Npb25zLnB1c2goe2RvbTogZG9tLCBleHByOiBkb20ubm9kZVZhbHVlfSk7IH1cblxuICAgICAgaWYgKHR5cGUgIT09IDEpIHsgcmV0dXJuIH1cblxuICAgICAgdmFyIGlzVmlydHVhbCA9IGRvbS50YWdOYW1lID09PSAnVklSVFVBTCc7XG5cbiAgICAgIC8vIGxvb3AuIGVhY2ggZG9lcyBpdCdzIG93biB0aGluZyAoZm9yIG5vdylcbiAgICAgIGlmIChhdHRyID0gZ2V0QXR0cmlidXRlKGRvbSwgTE9PUF9ESVJFQ1RJVkUpKSB7XG4gICAgICAgIGlmKGlzVmlydHVhbCkgeyBzZXRBdHRyaWJ1dGUoZG9tLCAnbG9vcFZpcnR1YWwnLCB0cnVlKTsgfSAvLyBpZ25vcmUgaGVyZSwgaGFuZGxlZCBpbiBfZWFjaFxuICAgICAgICBleHByZXNzaW9ucy5wdXNoKF9lYWNoKGRvbSwgdGhpcyQxLCBhdHRyKSk7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuXG4gICAgICAvLyBpZi1hdHRycyBiZWNvbWUgdGhlIG5ldyBwYXJlbnQuIEFueSBmb2xsb3dpbmcgZXhwcmVzc2lvbnMgKGVpdGhlciBvbiB0aGUgY3VycmVudFxuICAgICAgLy8gZWxlbWVudCwgb3IgYmVsb3cgaXQpIGJlY29tZSBjaGlsZHJlbiBvZiB0aGlzIGV4cHJlc3Npb24uXG4gICAgICBpZiAoYXR0ciA9IGdldEF0dHJpYnV0ZShkb20sIENPTkRJVElPTkFMX0RJUkVDVElWRSkpIHtcbiAgICAgICAgZXhwcmVzc2lvbnMucHVzaChjcmVhdGVJZkRpcmVjdGl2ZShkb20sIHRoaXMkMSwgYXR0cikpO1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgaWYgKGF0dHIgPSBnZXRBdHRyaWJ1dGUoZG9tLCBJU19ESVJFQ1RJVkUpKSB7XG4gICAgICAgIGlmICh0bXBsLmhhc0V4cHIoYXR0cikpIHtcbiAgICAgICAgICBleHByZXNzaW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlzUnRhZzogdHJ1ZSxcbiAgICAgICAgICAgIGV4cHI6IGF0dHIsXG4gICAgICAgICAgICBkb206IGRvbSxcbiAgICAgICAgICAgIGF0dHJzOiBbXS5zbGljZS5jYWxsKGRvbS5hdHRyaWJ1dGVzKVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gaWYgdGhpcyBpcyBhIHRhZywgc3RvcCB0cmF2ZXJzaW5nIGhlcmUuXG4gICAgICAvLyB3ZSBpZ25vcmUgdGhlIHJvb3QsIHNpbmNlIHBhcnNlRXhwcmVzc2lvbnMgaXMgY2FsbGVkIHdoaWxlIHdlJ3JlIG1vdW50aW5nIHRoYXQgcm9vdFxuICAgICAgdGFnSW1wbCA9IGdldChkb20pO1xuXG4gICAgICBpZihpc1ZpcnR1YWwpIHtcbiAgICAgICAgaWYoZ2V0QXR0cmlidXRlKGRvbSwgJ3ZpcnR1YWxpemVkJykpIHtkb20ucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChkb20pOyB9IC8vIHRhZyBjcmVhdGVkLCByZW1vdmUgZnJvbSBkb21cbiAgICAgICAgaWYoIXRhZ0ltcGwgJiYgIWdldEF0dHJpYnV0ZShkb20sICd2aXJ0dWFsaXplZCcpICYmICFnZXRBdHRyaWJ1dGUoZG9tLCAnbG9vcFZpcnR1YWwnKSkgIC8vIG9rIHRvIGNyZWF0ZSB2aXJ0dWFsIHRhZ1xuICAgICAgICAgIHsgdGFnSW1wbCA9IHsgdG1wbDogZG9tLm91dGVySFRNTCB9OyB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0YWdJbXBsICYmIChkb20gIT09IHJvb3QgfHwgbXVzdEluY2x1ZGVSb290KSkge1xuICAgICAgICB2YXIgaGFzSXNEaXJlY3RpdmUgPSBnZXRBdHRyaWJ1dGUoZG9tLCBJU19ESVJFQ1RJVkUpO1xuICAgICAgICBpZihpc1ZpcnR1YWwgJiYgIWhhc0lzRGlyZWN0aXZlKSB7IC8vIGhhbmRsZWQgaW4gdXBkYXRlXG4gICAgICAgICAgLy8gY2FuIG5vdCByZW1vdmUgYXR0cmlidXRlIGxpa2UgZGlyZWN0aXZlc1xuICAgICAgICAgIC8vIHNvIGZsYWcgZm9yIHJlbW92YWwgYWZ0ZXIgY3JlYXRpb24gdG8gcHJldmVudCBtYXhpbXVtIHN0YWNrIGVycm9yXG4gICAgICAgICAgc2V0QXR0cmlidXRlKGRvbSwgJ3ZpcnR1YWxpemVkJywgdHJ1ZSk7XG4gICAgICAgICAgdmFyIHRhZyA9IGNyZWF0ZVRhZyhcbiAgICAgICAgICAgIHt0bXBsOiBkb20ub3V0ZXJIVE1MfSxcbiAgICAgICAgICAgIHtyb290OiBkb20sIHBhcmVudDogdGhpcyQxfSxcbiAgICAgICAgICAgIGRvbS5pbm5lckhUTUxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgZXhwcmVzc2lvbnMucHVzaCh0YWcpOyAvLyBubyByZXR1cm4sIGFub255bW91cyB0YWcsIGtlZXAgcGFyc2luZ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChoYXNJc0RpcmVjdGl2ZSAmJiBpc1ZpcnR1YWwpXG4gICAgICAgICAgICB7IHdhcm4oKFwiVmlydHVhbCB0YWdzIHNob3VsZG4ndCBiZSB1c2VkIHRvZ2V0aGVyIHdpdGggdGhlIFxcXCJcIiArIElTX0RJUkVDVElWRSArIFwiXFxcIiBhdHRyaWJ1dGUgLSBodHRwczovL2dpdGh1Yi5jb20vcmlvdC9yaW90L2lzc3Vlcy8yNTExXCIpKTsgfVxuXG4gICAgICAgICAgZXhwcmVzc2lvbnMucHVzaChcbiAgICAgICAgICAgIGluaXRDaGlsZChcbiAgICAgICAgICAgICAgdGFnSW1wbCxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJvb3Q6IGRvbSxcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IHRoaXMkMVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBkb20uaW5uZXJIVE1MLFxuICAgICAgICAgICAgICB0aGlzJDFcbiAgICAgICAgICAgIClcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIGF0dHJpYnV0ZSBleHByZXNzaW9uc1xuICAgICAgcGFyc2VBdHRyaWJ1dGVzLmFwcGx5KHRoaXMkMSwgW2RvbSwgZG9tLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uIChhdHRyLCBleHByKSB7XG4gICAgICAgIGlmICghZXhwcikgeyByZXR1cm4gfVxuICAgICAgICBleHByZXNzaW9ucy5wdXNoKGV4cHIpO1xuICAgICAgfV0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGV4cHJlc3Npb25zXG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgYGZuYCBmb3IgZXZlcnkgYXR0cmlidXRlIG9uIGFuIGVsZW1lbnQuIElmIHRoYXQgYXR0ciBoYXMgYW4gZXhwcmVzc2lvbixcbiAgICogaXQgaXMgYWxzbyBwYXNzZWQgdG8gZm4uXG4gICAqIEB0aGlzIFRhZ1xuICAgKiBAcGFyYW0gICB7IEhUTUxFbGVtZW50IH0gZG9tIC0gZG9tIG5vZGUgdG8gcGFyc2VcbiAgICogQHBhcmFtICAgeyBBcnJheSB9IGF0dHJzIC0gYXJyYXkgb2YgYXR0cmlidXRlc1xuICAgKiBAcGFyYW0gICB7IEZ1bmN0aW9uIH0gZm4gLSBjYWxsYmFjayB0byBleGVjIG9uIGFueSBpdGVyYXRpb25cbiAgICovXG4gIGZ1bmN0aW9uIHBhcnNlQXR0cmlidXRlcyhkb20sIGF0dHJzLCBmbikge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgZWFjaChhdHRycywgZnVuY3Rpb24gKGF0dHIpIHtcbiAgICAgIGlmICghYXR0cikgeyByZXR1cm4gZmFsc2UgfVxuXG4gICAgICB2YXIgbmFtZSA9IGF0dHIubmFtZTtcbiAgICAgIHZhciBib29sID0gaXNCb29sQXR0cihuYW1lKTtcbiAgICAgIHZhciBleHByO1xuXG4gICAgICBpZiAoY29udGFpbnMoUkVGX0RJUkVDVElWRVMsIG5hbWUpICYmIGRvbS50YWdOYW1lLnRvTG93ZXJDYXNlKCkgIT09IFlJRUxEX1RBRykge1xuICAgICAgICBleHByID0gIGNyZWF0ZVJlZkRpcmVjdGl2ZShkb20sIHRoaXMkMSwgbmFtZSwgYXR0ci52YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHRtcGwuaGFzRXhwcihhdHRyLnZhbHVlKSkge1xuICAgICAgICBleHByID0ge2RvbTogZG9tLCBleHByOiBhdHRyLnZhbHVlLCBhdHRyOiBuYW1lLCBib29sOiBib29sfTtcbiAgICAgIH1cblxuICAgICAgZm4oYXR0ciwgZXhwcik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTWFuYWdlIHRoZSBtb3VudCBzdGF0ZSBvZiBhIHRhZyB0cmlnZ2VyaW5nIGFsc28gdGhlIG9ic2VydmFibGUgZXZlbnRzXG4gICAqIEB0aGlzIFRhZ1xuICAgKiBAcGFyYW0geyBCb29sZWFuIH0gdmFsdWUgLSAuLm9mIHRoZSBpc01vdW50ZWQgZmxhZ1xuICAgKi9cbiAgZnVuY3Rpb24gc2V0TW91bnRTdGF0ZSh2YWx1ZSkge1xuICAgIHZhciByZWYgPSB0aGlzLl9fO1xuICAgIHZhciBpc0Fub255bW91cyA9IHJlZi5pc0Fub255bW91cztcbiAgICB2YXIgc2tpcEFub255bW91cyA9IHJlZi5za2lwQW5vbnltb3VzO1xuXG4gICAgZGVmaW5lKHRoaXMsICdpc01vdW50ZWQnLCB2YWx1ZSk7XG5cbiAgICBpZiAoIWlzQW5vbnltb3VzIHx8ICFza2lwQW5vbnltb3VzKSB7XG4gICAgICBpZiAodmFsdWUpIHsgdGhpcy50cmlnZ2VyKCdtb3VudCcpOyB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCd1bm1vdW50Jyk7XG4gICAgICAgIHRoaXMub2ZmKCcqJyk7XG4gICAgICAgIHRoaXMuX18ud2FzQ3JlYXRlZCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNb3VudCB0aGUgY3VycmVudCB0YWcgaW5zdGFuY2VcbiAgICogQHJldHVybnMgeyBUYWcgfSB0aGUgY3VycmVudCB0YWcgaW5zdGFuY2VcbiAgICovXG4gIGZ1bmN0aW9uIGNvbXBvbmVudE1vdW50KHRhZyQkMSwgZG9tLCBleHByZXNzaW9ucywgb3B0cykge1xuICAgIHZhciBfXyA9IHRhZyQkMS5fXztcbiAgICB2YXIgcm9vdCA9IF9fLnJvb3Q7XG4gICAgcm9vdC5fdGFnID0gdGFnJCQxOyAvLyBrZWVwIGEgcmVmZXJlbmNlIHRvIHRoZSB0YWcganVzdCBjcmVhdGVkXG5cbiAgICAvLyBSZWFkIGFsbCB0aGUgYXR0cnMgb24gdGhpcyBpbnN0YW5jZS4gVGhpcyBnaXZlIHVzIHRoZSBpbmZvIHdlIG5lZWQgZm9yIHVwZGF0ZU9wdHNcbiAgICBwYXJzZUF0dHJpYnV0ZXMuYXBwbHkoX18ucGFyZW50LCBbcm9vdCwgcm9vdC5hdHRyaWJ1dGVzLCBmdW5jdGlvbiAoYXR0ciwgZXhwcikge1xuICAgICAgaWYgKCFfXy5pc0Fub255bW91cyAmJiBSZWZFeHByLmlzUHJvdG90eXBlT2YoZXhwcikpIHsgZXhwci50YWcgPSB0YWckJDE7IH1cbiAgICAgIGF0dHIuZXhwciA9IGV4cHI7XG4gICAgICBfXy5pbnN0QXR0cnMucHVzaChhdHRyKTtcbiAgICB9XSk7XG5cbiAgICAvLyB1cGRhdGUgdGhlIHJvb3QgYWRkaW5nIGN1c3RvbSBhdHRyaWJ1dGVzIGNvbWluZyBmcm9tIHRoZSBjb21waWxlclxuICAgIHdhbGtBdHRyaWJ1dGVzKF9fLmltcGwuYXR0cnMsIGZ1bmN0aW9uIChrLCB2KSB7IF9fLmltcGxBdHRycy5wdXNoKHtuYW1lOiBrLCB2YWx1ZTogdn0pOyB9KTtcbiAgICBwYXJzZUF0dHJpYnV0ZXMuYXBwbHkodGFnJCQxLCBbcm9vdCwgX18uaW1wbEF0dHJzLCBmdW5jdGlvbiAoYXR0ciwgZXhwcikge1xuICAgICAgaWYgKGV4cHIpIHsgZXhwcmVzc2lvbnMucHVzaChleHByKTsgfVxuICAgICAgZWxzZSB7IHNldEF0dHJpYnV0ZShyb290LCBhdHRyLm5hbWUsIGF0dHIudmFsdWUpOyB9XG4gICAgfV0pO1xuXG4gICAgLy8gaW5pdGlhbGlhdGlvblxuICAgIHVwZGF0ZU9wdHMuYXBwbHkodGFnJCQxLCBbX18uaXNMb29wLCBfXy5wYXJlbnQsIF9fLmlzQW5vbnltb3VzLCBvcHRzLCBfXy5pbnN0QXR0cnNdKTtcblxuICAgIC8vIGFkZCBnbG9iYWwgbWl4aW5zXG4gICAgdmFyIGdsb2JhbE1peGluID0gbWl4aW4oR0xPQkFMX01JWElOKTtcblxuICAgIGlmIChnbG9iYWxNaXhpbiAmJiAhX18uc2tpcEFub255bW91cykge1xuICAgICAgZm9yICh2YXIgaSBpbiBnbG9iYWxNaXhpbikge1xuICAgICAgICBpZiAoZ2xvYmFsTWl4aW4uaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgICB0YWckJDEubWl4aW4oZ2xvYmFsTWl4aW5baV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKF9fLmltcGwuZm4pIHsgX18uaW1wbC5mbi5jYWxsKHRhZyQkMSwgb3B0cyk7IH1cblxuICAgIGlmICghX18uc2tpcEFub255bW91cykgeyB0YWckJDEudHJpZ2dlcignYmVmb3JlLW1vdW50Jyk7IH1cblxuICAgIC8vIHBhcnNlIGxheW91dCBhZnRlciBpbml0LiBmbiBtYXkgY2FsY3VsYXRlIGFyZ3MgZm9yIG5lc3RlZCBjdXN0b20gdGFnc1xuICAgIGVhY2gocGFyc2VFeHByZXNzaW9ucy5hcHBseSh0YWckJDEsIFtkb20sIF9fLmlzQW5vbnltb3VzXSksIGZ1bmN0aW9uIChlKSB7IHJldHVybiBleHByZXNzaW9ucy5wdXNoKGUpOyB9KTtcblxuICAgIHRhZyQkMS51cGRhdGUoX18uaXRlbSk7XG5cbiAgICBpZiAoIV9fLmlzQW5vbnltb3VzICYmICFfXy5pc0lubGluZSkge1xuICAgICAgd2hpbGUgKGRvbS5maXJzdENoaWxkKSB7IHJvb3QuYXBwZW5kQ2hpbGQoZG9tLmZpcnN0Q2hpbGQpOyB9XG4gICAgfVxuXG4gICAgZGVmaW5lKHRhZyQkMSwgJ3Jvb3QnLCByb290KTtcblxuICAgIC8vIGlmIHdlIG5lZWQgdG8gd2FpdCB0aGF0IHRoZSBwYXJlbnQgXCJtb3VudFwiIG9yIFwidXBkYXRlZFwiIGV2ZW50IGdldHMgdHJpZ2dlcmVkXG4gICAgaWYgKCFfXy5za2lwQW5vbnltb3VzICYmIHRhZyQkMS5wYXJlbnQpIHtcbiAgICAgIHZhciBwID0gZ2V0SW1tZWRpYXRlQ3VzdG9tUGFyZW50KHRhZyQkMS5wYXJlbnQpO1xuICAgICAgcC5vbmUoIXAuaXNNb3VudGVkID8gJ21vdW50JyA6ICd1cGRhdGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzZXRNb3VudFN0YXRlLmNhbGwodGFnJCQxLCB0cnVlKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBvdGhlcndpc2UgaXQncyBub3QgYSBjaGlsZCB0YWcgd2UgY2FuIHRyaWdnZXIgaXRzIG1vdW50IGV2ZW50XG4gICAgICBzZXRNb3VudFN0YXRlLmNhbGwodGFnJCQxLCB0cnVlKTtcbiAgICB9XG5cbiAgICB0YWckJDEuX18ud2FzQ3JlYXRlZCA9IHRydWU7XG5cbiAgICByZXR1cm4gdGFnJCQxXG4gIH1cblxuICAvKipcbiAgICogVW5tb3VudCB0aGUgdGFnIGluc3RhbmNlXG4gICAqIEBwYXJhbSB7IEJvb2xlYW4gfSBtdXN0S2VlcFJvb3QgLSBpZiBpdCdzIHRydWUgdGhlIHJvb3Qgbm9kZSB3aWxsIG5vdCBiZSByZW1vdmVkXG4gICAqIEByZXR1cm5zIHsgVGFnIH0gdGhlIGN1cnJlbnQgdGFnIGluc3RhbmNlXG4gICAqL1xuICBmdW5jdGlvbiB0YWdVbm1vdW50KHRhZywgbXVzdEtlZXBSb290LCBleHByZXNzaW9ucykge1xuICAgIHZhciBfXyA9IHRhZy5fXztcbiAgICB2YXIgcm9vdCA9IF9fLnJvb3Q7XG4gICAgdmFyIHRhZ0luZGV4ID0gX19UQUdTX0NBQ0hFLmluZGV4T2YodGFnKTtcbiAgICB2YXIgcCA9IHJvb3QucGFyZW50Tm9kZTtcblxuICAgIGlmICghX18uc2tpcEFub255bW91cykgeyB0YWcudHJpZ2dlcignYmVmb3JlLXVubW91bnQnKTsgfVxuXG4gICAgLy8gY2xlYXIgYWxsIGF0dHJpYnV0ZXMgY29taW5nIGZyb20gdGhlIG1vdW50ZWQgdGFnXG4gICAgd2Fsa0F0dHJpYnV0ZXMoX18uaW1wbC5hdHRycywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIGlmIChzdGFydHNXaXRoKG5hbWUsIEFUVFJTX1BSRUZJWCkpXG4gICAgICAgIHsgbmFtZSA9IG5hbWUuc2xpY2UoQVRUUlNfUFJFRklYLmxlbmd0aCk7IH1cblxuICAgICAgcmVtb3ZlQXR0cmlidXRlKHJvb3QsIG5hbWUpO1xuICAgIH0pO1xuXG4gICAgLy8gcmVtb3ZlIGFsbCB0aGUgZXZlbnQgbGlzdGVuZXJzXG4gICAgdGFnLl9fLmxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChkb20pIHtcbiAgICAgIE9iamVjdC5rZXlzKGRvbVtSSU9UX0VWRU5UU19LRVldKS5mb3JFYWNoKGZ1bmN0aW9uIChldmVudE5hbWUpIHtcbiAgICAgICAgZG9tLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBkb21bUklPVF9FVkVOVFNfS0VZXVtldmVudE5hbWVdKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gcmVtb3ZlIHRhZyBpbnN0YW5jZSBmcm9tIHRoZSBnbG9iYWwgdGFncyBjYWNoZSBjb2xsZWN0aW9uXG4gICAgaWYgKHRhZ0luZGV4ICE9PSAtMSkgeyBfX1RBR1NfQ0FDSEUuc3BsaWNlKHRhZ0luZGV4LCAxKTsgfVxuXG4gICAgLy8gY2xlYW4gdXAgdGhlIHBhcmVudCB0YWdzIG9iamVjdFxuICAgIGlmIChfXy5wYXJlbnQgJiYgIV9fLmlzQW5vbnltb3VzKSB7XG4gICAgICB2YXIgcHRhZyA9IGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudChfXy5wYXJlbnQpO1xuXG4gICAgICBpZiAoX18uaXNWaXJ0dWFsKSB7XG4gICAgICAgIE9iamVjdFxuICAgICAgICAgIC5rZXlzKHRhZy50YWdzKVxuICAgICAgICAgIC5mb3JFYWNoKGZ1bmN0aW9uICh0YWdOYW1lKSB7IHJldHVybiBhcnJheWlzaFJlbW92ZShwdGFnLnRhZ3MsIHRhZ05hbWUsIHRhZy50YWdzW3RhZ05hbWVdKTsgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcnJheWlzaFJlbW92ZShwdGFnLnRhZ3MsIF9fLnRhZ05hbWUsIHRhZyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdW5tb3VudCBhbGwgdGhlIHZpcnR1YWwgZGlyZWN0aXZlc1xuICAgIGlmICh0YWcuX18udmlydHMpIHtcbiAgICAgIGVhY2godGFnLl9fLnZpcnRzLCBmdW5jdGlvbiAodikge1xuICAgICAgICBpZiAodi5wYXJlbnROb2RlKSB7IHYucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh2KTsgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gYWxsb3cgZXhwcmVzc2lvbnMgdG8gdW5tb3VudCB0aGVtc2VsdmVzXG4gICAgdW5tb3VudEFsbChleHByZXNzaW9ucyk7XG4gICAgZWFjaChfXy5pbnN0QXR0cnMsIGZ1bmN0aW9uIChhKSB7IHJldHVybiBhLmV4cHIgJiYgYS5leHByLnVubW91bnQgJiYgYS5leHByLnVubW91bnQoKTsgfSk7XG5cbiAgICAvLyBjbGVhciB0aGUgdGFnIGh0bWwgaWYgaXQncyBuZWNlc3NhcnlcbiAgICBpZiAobXVzdEtlZXBSb290KSB7IHNldElubmVySFRNTChyb290LCAnJyk7IH1cbiAgICAvLyBvdGhlcndpc2UgZGV0YWNoIHRoZSByb290IHRhZyBmcm9tIHRoZSBET01cbiAgICBlbHNlIGlmIChwKSB7IHAucmVtb3ZlQ2hpbGQocm9vdCk7IH1cblxuICAgIC8vIGN1c3RvbSBpbnRlcm5hbCB1bm1vdW50IGZ1bmN0aW9uIHRvIGF2b2lkIHJlbHlpbmcgb24gdGhlIG9ic2VydmFibGVcbiAgICBpZiAoX18ub25Vbm1vdW50KSB7IF9fLm9uVW5tb3VudCgpOyB9XG5cbiAgICAvLyB3ZWlyZCBmaXggZm9yIGEgd2VpcmQgZWRnZSBjYXNlICMyNDA5IGFuZCAjMjQzNlxuICAgIC8vIHNvbWUgdXNlcnMgbWlnaHQgdXNlIHlvdXIgc29mdHdhcmUgbm90IGFzIHlvdSd2ZSBleHBlY3RlZFxuICAgIC8vIHNvIEkgbmVlZCB0byBhZGQgdGhlc2UgZGlydHkgaGFja3MgdG8gbWl0aWdhdGUgdW5leHBlY3RlZCBpc3N1ZXNcbiAgICBpZiAoIXRhZy5pc01vdW50ZWQpIHsgc2V0TW91bnRTdGF0ZS5jYWxsKHRhZywgdHJ1ZSk7IH1cblxuICAgIHNldE1vdW50U3RhdGUuY2FsbCh0YWcsIGZhbHNlKTtcblxuICAgIGRlbGV0ZSByb290Ll90YWc7XG5cbiAgICByZXR1cm4gdGFnXG4gIH1cblxuICAvKipcbiAgICogVGFnIGNyZWF0aW9uIGZhY3RvcnkgZnVuY3Rpb25cbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7IE9iamVjdCB9IGltcGwgLSBpdCBjb250YWlucyB0aGUgdGFnIHRlbXBsYXRlLCBhbmQgbG9naWNcbiAgICogQHBhcmFtIHsgT2JqZWN0IH0gY29uZiAtIHRhZyBvcHRpb25zXG4gICAqIEBwYXJhbSB7IFN0cmluZyB9IGlubmVySFRNTCAtIGh0bWwgdGhhdCBldmVudHVhbGx5IHdlIG5lZWQgdG8gaW5qZWN0IGluIHRoZSB0YWdcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZVRhZyhpbXBsLCBjb25mLCBpbm5lckhUTUwpIHtcbiAgICBpZiAoIGltcGwgPT09IHZvaWQgMCApIGltcGwgPSB7fTtcbiAgICBpZiAoIGNvbmYgPT09IHZvaWQgMCApIGNvbmYgPSB7fTtcblxuICAgIHZhciB0YWcgPSBjb25mLmNvbnRleHQgfHwge307XG4gICAgdmFyIG9wdHMgPSBjb25mLm9wdHMgfHwge307XG4gICAgdmFyIHBhcmVudCA9IGNvbmYucGFyZW50O1xuICAgIHZhciBpc0xvb3AgPSBjb25mLmlzTG9vcDtcbiAgICB2YXIgaXNBbm9ueW1vdXMgPSAhIWNvbmYuaXNBbm9ueW1vdXM7XG4gICAgdmFyIHNraXBBbm9ueW1vdXMgPSBzZXR0aW5ncy5za2lwQW5vbnltb3VzVGFncyAmJiBpc0Fub255bW91cztcbiAgICB2YXIgaXRlbSA9IGNvbmYuaXRlbTtcbiAgICAvLyBhdmFpbGFibGUgb25seSBmb3IgdGhlIGxvb3BlZCBub2Rlc1xuICAgIHZhciBpbmRleCA9IGNvbmYuaW5kZXg7XG4gICAgLy8gQWxsIGF0dHJpYnV0ZXMgb24gdGhlIFRhZyB3aGVuIGl0J3MgZmlyc3QgcGFyc2VkXG4gICAgdmFyIGluc3RBdHRycyA9IFtdO1xuICAgIC8vIGV4cHJlc3Npb25zIG9uIHRoaXMgdHlwZSBvZiBUYWdcbiAgICB2YXIgaW1wbEF0dHJzID0gW107XG4gICAgdmFyIHRtcGwgPSBpbXBsLnRtcGw7XG4gICAgdmFyIGV4cHJlc3Npb25zID0gW107XG4gICAgdmFyIHJvb3QgPSBjb25mLnJvb3Q7XG4gICAgdmFyIHRhZ05hbWUgPSBjb25mLnRhZ05hbWUgfHwgZ2V0TmFtZShyb290KTtcbiAgICB2YXIgaXNWaXJ0dWFsID0gdGFnTmFtZSA9PT0gJ3ZpcnR1YWwnO1xuICAgIHZhciBpc0lubGluZSA9ICFpc1ZpcnR1YWwgJiYgIXRtcGw7XG4gICAgdmFyIGRvbTtcblxuICAgIGlmIChpc0lubGluZSB8fCBpc0xvb3AgJiYgaXNBbm9ueW1vdXMpIHtcbiAgICAgIGRvbSA9IHJvb3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghaXNWaXJ0dWFsKSB7IHJvb3QuaW5uZXJIVE1MID0gJyc7IH1cbiAgICAgIGRvbSA9IG1rZG9tKHRtcGwsIGlubmVySFRNTCwgaXNTdmcocm9vdCkpO1xuICAgIH1cblxuICAgIC8vIG1ha2UgdGhpcyB0YWcgb2JzZXJ2YWJsZVxuICAgIGlmICghc2tpcEFub255bW91cykgeyBvYnNlcnZhYmxlKHRhZyk7IH1cblxuICAgIC8vIG9ubHkgY2FsbCB1bm1vdW50IGlmIHdlIGhhdmUgYSB2YWxpZCBfX1RBR19JTVBMIChoYXMgbmFtZSBwcm9wZXJ0eSlcbiAgICBpZiAoaW1wbC5uYW1lICYmIHJvb3QuX3RhZykgeyByb290Ll90YWcudW5tb3VudCh0cnVlKTsgfVxuXG4gICAgZGVmaW5lKHRhZywgJ19fJywge1xuICAgICAgaW1wbDogaW1wbCxcbiAgICAgIHJvb3Q6IHJvb3QsXG4gICAgICBza2lwQW5vbnltb3VzOiBza2lwQW5vbnltb3VzLFxuICAgICAgaW1wbEF0dHJzOiBpbXBsQXR0cnMsXG4gICAgICBpc0Fub255bW91czogaXNBbm9ueW1vdXMsXG4gICAgICBpbnN0QXR0cnM6IGluc3RBdHRycyxcbiAgICAgIGlubmVySFRNTDogaW5uZXJIVE1MLFxuICAgICAgdGFnTmFtZTogdGFnTmFtZSxcbiAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgIGlzTG9vcDogaXNMb29wLFxuICAgICAgaXNJbmxpbmU6IGlzSW5saW5lLFxuICAgICAgaXRlbTogaXRlbSxcbiAgICAgIHBhcmVudDogcGFyZW50LFxuICAgICAgLy8gdGFncyBoYXZpbmcgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAvLyBpdCB3b3VsZCBiZSBiZXR0ZXIgdG8gdXNlIHdlYWsgbWFwcyBoZXJlIGJ1dCB3ZSBjYW4gbm90IGludHJvZHVjZSBicmVha2luZyBjaGFuZ2VzIG5vd1xuICAgICAgbGlzdGVuZXJzOiBbXSxcbiAgICAgIC8vIHRoZXNlIHZhcnMgd2lsbCBiZSBuZWVkZWQgb25seSBmb3IgdGhlIHZpcnR1YWwgdGFnc1xuICAgICAgdmlydHM6IFtdLFxuICAgICAgd2FzQ3JlYXRlZDogZmFsc2UsXG4gICAgICB0YWlsOiBudWxsLFxuICAgICAgaGVhZDogbnVsbFxuICAgIH0pO1xuXG4gICAgLy8gdGFnIHByb3RlY3RlZCBwcm9wZXJ0aWVzXG4gICAgcmV0dXJuIFtcbiAgICAgIFsnaXNNb3VudGVkJywgZmFsc2VdLFxuICAgICAgLy8gY3JlYXRlIGEgdW5pcXVlIGlkIHRvIHRoaXMgdGFnXG4gICAgICAvLyBpdCBjb3VsZCBiZSBoYW5keSB0byB1c2UgaXQgYWxzbyB0byBpbXByb3ZlIHRoZSB2aXJ0dWFsIGRvbSByZW5kZXJpbmcgc3BlZWRcbiAgICAgIFsnX3Jpb3RfaWQnLCB1aWQoKV0sXG4gICAgICBbJ3Jvb3QnLCByb290XSxcbiAgICAgIFsnb3B0cycsIG9wdHMsIHsgd3JpdGFibGU6IHRydWUsIGVudW1lcmFibGU6IHRydWUgfV0sXG4gICAgICBbJ3BhcmVudCcsIHBhcmVudCB8fCBudWxsXSxcbiAgICAgIC8vIHByb3RlY3QgdGhlIFwidGFnc1wiIGFuZCBcInJlZnNcIiBwcm9wZXJ0eSBmcm9tIGJlaW5nIG92ZXJyaWRkZW5cbiAgICAgIFsndGFncycsIHt9XSxcbiAgICAgIFsncmVmcycsIHt9XSxcbiAgICAgIFsndXBkYXRlJywgZnVuY3Rpb24gKGRhdGEpIHsgcmV0dXJuIGNvbXBvbmVudFVwZGF0ZSh0YWcsIGRhdGEsIGV4cHJlc3Npb25zKTsgfV0sXG4gICAgICBbJ21peGluJywgZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbWl4aW5zID0gW10sIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIHdoaWxlICggbGVuLS0gKSBtaXhpbnNbIGxlbiBdID0gYXJndW1lbnRzWyBsZW4gXTtcblxuICAgICAgICByZXR1cm4gY29tcG9uZW50TWl4aW4uYXBwbHkodm9pZCAwLCBbIHRhZyBdLmNvbmNhdCggbWl4aW5zICkpO1xuICAgIH1dLFxuICAgICAgWydtb3VudCcsIGZ1bmN0aW9uICgpIHsgcmV0dXJuIGNvbXBvbmVudE1vdW50KHRhZywgZG9tLCBleHByZXNzaW9ucywgb3B0cyk7IH1dLFxuICAgICAgWyd1bm1vdW50JywgZnVuY3Rpb24gKG11c3RLZWVwUm9vdCkgeyByZXR1cm4gdGFnVW5tb3VudCh0YWcsIG11c3RLZWVwUm9vdCwgZXhwcmVzc2lvbnMpOyB9XVxuICAgIF0ucmVkdWNlKGZ1bmN0aW9uIChhY2MsIHJlZikge1xuICAgICAgdmFyIGtleSA9IHJlZlswXTtcbiAgICAgIHZhciB2YWx1ZSA9IHJlZlsxXTtcbiAgICAgIHZhciBvcHRzID0gcmVmWzJdO1xuXG4gICAgICBkZWZpbmUodGFnLCBrZXksIHZhbHVlLCBvcHRzKTtcbiAgICAgIHJldHVybiBhY2NcbiAgICB9LCBleHRlbmQodGFnLCBpdGVtKSlcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3VudCBhIHRhZyBjcmVhdGluZyBuZXcgVGFnIGluc3RhbmNlXG4gICAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gcm9vdCAtIGRvbSBub2RlIHdoZXJlIHRoZSB0YWcgd2lsbCBiZSBtb3VudGVkXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gdGFnTmFtZSAtIG5hbWUgb2YgdGhlIHJpb3QgdGFnIHdlIHdhbnQgdG8gbW91bnRcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBvcHRzIC0gb3B0aW9ucyB0byBwYXNzIHRvIHRoZSBUYWcgaW5zdGFuY2VcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBjdHggLSBvcHRpb25hbCBjb250ZXh0IHRoYXQgd2lsbCBiZSB1c2VkIHRvIGV4dGVuZCBhbiBleGlzdGluZyBjbGFzcyAoIHVzZWQgaW4gcmlvdC5UYWcgKVxuICAgKiBAcmV0dXJucyB7IFRhZyB9IGEgbmV3IFRhZyBpbnN0YW5jZVxuICAgKi9cbiAgZnVuY3Rpb24gbW91bnQkMShyb290LCB0YWdOYW1lLCBvcHRzLCBjdHgpIHtcbiAgICB2YXIgaW1wbCA9IF9fVEFHX0lNUExbdGFnTmFtZV07XG4gICAgdmFyIGltcGxDbGFzcyA9IF9fVEFHX0lNUExbdGFnTmFtZV0uY2xhc3M7XG4gICAgdmFyIGNvbnRleHQgPSBjdHggfHwgKGltcGxDbGFzcyA/IGNyZWF0ZShpbXBsQ2xhc3MucHJvdG90eXBlKSA6IHt9KTtcbiAgICAvLyBjYWNoZSB0aGUgaW5uZXIgSFRNTCB0byBmaXggIzg1NVxuICAgIHZhciBpbm5lckhUTUwgPSByb290Ll9pbm5lckhUTUwgPSByb290Ll9pbm5lckhUTUwgfHwgcm9vdC5pbm5lckhUTUw7XG4gICAgdmFyIGNvbmYgPSBleHRlbmQoeyByb290OiByb290LCBvcHRzOiBvcHRzLCBjb250ZXh0OiBjb250ZXh0IH0sIHsgcGFyZW50OiBvcHRzID8gb3B0cy5wYXJlbnQgOiBudWxsIH0pO1xuICAgIHZhciB0YWc7XG5cbiAgICBpZiAoaW1wbCAmJiByb290KSB7IHRhZyA9IGNyZWF0ZVRhZyhpbXBsLCBjb25mLCBpbm5lckhUTUwpOyB9XG5cbiAgICBpZiAodGFnICYmIHRhZy5tb3VudCkge1xuICAgICAgdGFnLm1vdW50KHRydWUpO1xuICAgICAgLy8gYWRkIHRoaXMgdGFnIHRvIHRoZSB2aXJ0dWFsRG9tIHZhcmlhYmxlXG4gICAgICBpZiAoIWNvbnRhaW5zKF9fVEFHU19DQUNIRSwgdGFnKSkgeyBfX1RBR1NfQ0FDSEUucHVzaCh0YWcpOyB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhZ1xuICB9XG5cblxuXG4gIHZhciB0YWdzID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuICAgIGFycmF5aXNoQWRkOiBhcnJheWlzaEFkZCxcbiAgICBnZXRUYWdOYW1lOiBnZXROYW1lLFxuICAgIGluaGVyaXRQYXJlbnRQcm9wczogaW5oZXJpdFBhcmVudFByb3BzLFxuICAgIG1vdW50VG86IG1vdW50JDEsXG4gICAgc2VsZWN0VGFnczogcXVlcnksXG4gICAgYXJyYXlpc2hSZW1vdmU6IGFycmF5aXNoUmVtb3ZlLFxuICAgIGdldFRhZzogZ2V0LFxuICAgIGluaXRDaGlsZFRhZzogaW5pdENoaWxkLFxuICAgIG1vdmVDaGlsZFRhZzogbW92ZUNoaWxkLFxuICAgIG1ha2VSZXBsYWNlVmlydHVhbDogbWFrZVJlcGxhY2VWaXJ0dWFsLFxuICAgIGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudFRhZzogZ2V0SW1tZWRpYXRlQ3VzdG9tUGFyZW50LFxuICAgIG1ha2VWaXJ0dWFsOiBtYWtlVmlydHVhbCxcbiAgICBtb3ZlVmlydHVhbDogbW92ZVZpcnR1YWwsXG4gICAgdW5tb3VudEFsbDogdW5tb3VudEFsbCxcbiAgICBjcmVhdGVJZkRpcmVjdGl2ZTogY3JlYXRlSWZEaXJlY3RpdmUsXG4gICAgY3JlYXRlUmVmRGlyZWN0aXZlOiBjcmVhdGVSZWZEaXJlY3RpdmVcbiAgfSk7XG5cbiAgLyoqXG4gICAqIFJpb3QgcHVibGljIGFwaVxuICAgKi9cbiAgdmFyIHNldHRpbmdzJDEgPSBzZXR0aW5ncztcbiAgdmFyIHV0aWwgPSB7XG4gICAgdG1wbDogdG1wbCxcbiAgICBicmFja2V0czogYnJhY2tldHMsXG4gICAgc3R5bGVNYW5hZ2VyOiBzdHlsZU1hbmFnZXIsXG4gICAgdmRvbTogX19UQUdTX0NBQ0hFLFxuICAgIHN0eWxlTm9kZTogc3R5bGVNYW5hZ2VyLnN0eWxlTm9kZSxcbiAgICAvLyBleHBvcnQgdGhlIHJpb3QgaW50ZXJuYWwgdXRpbHMgYXMgd2VsbFxuICAgIGRvbTogZG9tLFxuICAgIGNoZWNrOiBjaGVjayxcbiAgICBtaXNjOiBtaXNjLFxuICAgIHRhZ3M6IHRhZ3NcbiAgfTtcblxuICAvLyBleHBvcnQgdGhlIGNvcmUgcHJvcHMvbWV0aG9kc1xuICB2YXIgVGFnJDEgPSBUYWc7XG4gIHZhciB0YWckMSA9IHRhZztcbiAgdmFyIHRhZzIkMSA9IHRhZzI7XG4gIHZhciBtb3VudCQyID0gbW91bnQ7XG4gIHZhciBtaXhpbiQxID0gbWl4aW47XG4gIHZhciB1cGRhdGUkMiA9IHVwZGF0ZSQxO1xuICB2YXIgdW5yZWdpc3RlciQxID0gdW5yZWdpc3RlcjtcbiAgdmFyIHZlcnNpb24kMSA9IHZlcnNpb247XG4gIHZhciBvYnNlcnZhYmxlJDEgPSBvYnNlcnZhYmxlO1xuXG4gIHZhciByaW90JDEgPSBleHRlbmQoe30sIGNvcmUsIHtcbiAgICBvYnNlcnZhYmxlOiBvYnNlcnZhYmxlLFxuICAgIHNldHRpbmdzOiBzZXR0aW5ncyQxLFxuICAgIHV0aWw6IHV0aWwsXG4gIH0pO1xuXG4gIGV4cG9ydHMuc2V0dGluZ3MgPSBzZXR0aW5ncyQxO1xuICBleHBvcnRzLnV0aWwgPSB1dGlsO1xuICBleHBvcnRzLlRhZyA9IFRhZyQxO1xuICBleHBvcnRzLnRhZyA9IHRhZyQxO1xuICBleHBvcnRzLnRhZzIgPSB0YWcyJDE7XG4gIGV4cG9ydHMubW91bnQgPSBtb3VudCQyO1xuICBleHBvcnRzLm1peGluID0gbWl4aW4kMTtcbiAgZXhwb3J0cy51cGRhdGUgPSB1cGRhdGUkMjtcbiAgZXhwb3J0cy51bnJlZ2lzdGVyID0gdW5yZWdpc3RlciQxO1xuICBleHBvcnRzLnZlcnNpb24gPSB2ZXJzaW9uJDE7XG4gIGV4cG9ydHMub2JzZXJ2YWJsZSA9IG9ic2VydmFibGUkMTtcbiAgZXhwb3J0cy5kZWZhdWx0ID0gcmlvdCQxO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbn0pKSk7XG4iLCJjb25zdCByaW90ID0gcmVxdWlyZSgncmlvdCcpO1xuLy9pbmNsdWRlIHRhZ3NcbnJlcXVpcmUoJy4vdGFnL2FwcC50YWcucHVnJyk7XG5cbi8vbW91bnRcbnJpb3QubW91bnQoJyonKTsiLCJhcHBcbiAgICBkaXYudGVzdFxuICAgICAgICBoMSBhcHAudGFnXG4gICAgICAgIGJ1dHRvbihjbGljaz0ne2NsaWNrZWR9JykgY291bnQ6IHt0aGlzLmxpc3QubGVuZ3RofVxuICAgICAgICB1bFxuICAgICAgICAgICAgbGkoZWFjaD0ne2l0ZW0sIGluZGV4IGluIGxpc3R9Jykge2luZGV4fToge2l0ZW19XG5cbiAgICBzdHlsZS5cbiAgICAgICAgLnRlc3Qge1xuICAgICAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2RkZDtcbiAgICAgICAgfVxuXG4gICAgc2NyaXB0LlxuICAgICAgICB0aGlzLmxpc3QgPSBbXVxuXG4gICAgICAgIHRoaXMub24oJ21vdW50JywgKCkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1RFU1QgYXBwLnRhZyBtb3VudGVkJywgb3B0cylcbiAgICAgICAgfSlcblxuICAgICAgICBjbGlja2VkKGUpIHtcbiAgICAgICAgICAgIHRoaXMubGlzdC5wdXNoKG5ldyBEYXRlKCkudG9TdHJpbmcoKSlcbiAgICAgICAgfSJdfQ==
