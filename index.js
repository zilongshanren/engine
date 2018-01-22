/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Chukong Aipu reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

// MACROS

// if "global_defs" not preprocessed by uglify, just declare them globally,
// this may happened in release version's preview page.
var _global = typeof window === 'undefined' ? global : window;
function defineMacro (name, defaultValue) {
    // if "global_defs" not preprocessed by uglify, just declare them globally,
    // this may happened in release version's preview page.
    // (use evaled code to prevent mangle by uglify)
    if (typeof _global[name] == 'undefined') {
        _global[name] = defaultValue;
    }
}
function defined (name) {
    return typeof _global[name] == 'object';
}

defineMacro('CC_TEST', defined('tap') || defined('QUnit'));
defineMacro('CC_EDITOR', defined('Editor') && defined('process') && ('electron' in process.versions));
defineMacro('CC_PREVIEW', !CC_EDITOR);
defineMacro('CC_DEV', true);    // (CC_EDITOR && !CC_BUILD) || CC_PREVIEW || CC_TEST
defineMacro('CC_DEBUG', true);  // CC_DEV || Debug Build
defineMacro('CC_JSB', defined('jsb'));
defineMacro('CC_BUILD', false);


// PREDEFINE

require('./predefine');

cc.supportJit = false; //typeof Function('') === 'function';

// LOAD BUNDLED COCOS2D

var isMainProcess = CC_EDITOR && Editor.isMainProcess;
if (!isMainProcess) {
    // LOAD ORIGIN COCOS2D
    if (CC_EDITOR) {
        try {
            require('./bin/modular-cocos2d');
        }
        catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                Editor.Dialog.messageBox({
                    type: 'error',
                    buttons: [Editor.T('MESSAGE.ok')],
                    message: Editor.T('EDITOR_MAIN.engine_not_build'),
                    detail: e.stack,
                    noLink: true,
                });
                return;
            }
            else {
                throw e;
            }
        }
    }
    else {
        require('./bin/modular-cocos2d');
        if (!CC_TEST) {
            require('./bin/modular-cocos2d-cut');
        }
    }
}
else {
    // load modules for editor's core-level which included in modular-cocos2d.js
    cc._initDebugSetting(1);    // DEBUG_MODE_INFO
}

// LOAD EXTENDS FOR CREATOR

require('./extends');

if (CC_EDITOR) {
    /**
     * In editor, in addition to the modules defined in cc scope, you can also access to the internal modules by using _require.
     * @method _require
     * @example
     * var isDomNode = cc._require('./cocos2d/core/platform/utils').isDomNode;
     */
    cc._require = require;
    /*
     * Checks if the extension is loaded.
     * This method is used to make editor code more elegant, so only available in editor.
     * @param {string} moduleName - such as 'sp', 'dragonBones', 'TiledMap'... etc.
     */
    cc.hasExtension = function (moduleName) {
        return moduleName in global || moduleName in cc;
    };
}

if (isMainProcess) {
    Editor.versions['cocos2d'] = require('./package.json').version;
}

module.exports = cc;
