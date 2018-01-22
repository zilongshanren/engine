﻿/****************************************************************************
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

var JS = require('./js');
var isPlainEmptyObj = require('./utils').isPlainEmptyObj_DEV;

function createAttrsSingle (owner, ownerCtor, superAttrs) {
    var AttrsCtor;
    AttrsCtor = function () {};
    if (superAttrs) {
        JS.extend(AttrsCtor, superAttrs.constructor);
    }
    var attrs = new AttrsCtor();
    Object.defineProperty(owner, '__attrs__', {
        value: attrs,
    });
    return attrs;
}

// subclass should not have __attrs__
function createAttrs (subclass) {
    var superClass;
    var chains = cc.Class.getInheritanceChain(subclass);
    for (var i = chains.length - 1; i >= 0; i--) {
        var cls = chains[i];
        var attrs = cls.__attrs__;
        if (!attrs) {
            superClass = chains[i + 1];
            createAttrsSingle(cls, cls, superClass && superClass.__attrs__);
        }
    }
    superClass = chains[0];
    createAttrsSingle(subclass, subclass, superClass && superClass.__attrs__);
    return subclass.__attrs__;
}

var DELIMETER = '$_$';

// /**
//  * @class Class
//  */

//  *
//  * Tag the class with any meta attributes, then return all current attributes assigned to it.
//  * This function holds only the attributes, not their implementations.
//  *
//  * @method attr
//  * @param {Function|Object} ctor - the class or instance. If instance, the attribute will be dynamic and only available for the specified instance.
//  * @param {String} propName - the name of property or function, used to retrieve the attributes
//  * @param {Object} [newAttrs] - the attribute table to mark, new attributes will merged with existed attributes. Attribute whose key starts with '_' will be ignored.
//  * @static
//  * @private
function attr (ctor, propName, newAttrs) {
    var attrs, setter, key;
    if (typeof ctor === 'function') {
        // attributes shared between instances
        attrs = ctor.__attrs__ || createAttrs(ctor);
        setter = attrs.constructor.prototype;
    }
    else {
        // attributes in instance
        var instance = ctor;
        attrs = instance.__attrs__;
        if (!attrs) {
            ctor = instance.constructor;
            var clsAttrs = ctor.__attrs__ || createAttrs(ctor);
            attrs = createAttrsSingle(instance, ctor, clsAttrs);
        }
        setter = attrs;
    }

    if (typeof newAttrs === 'undefined') {
        // get
        var prefix = propName + DELIMETER;
        var ret = {};
        for (key in attrs) {
            if (key.startsWith(prefix)) {
                ret[key.slice(prefix.length)] = attrs[key];
            }
        }
        return ret;
    }
    else {
        // set
        if (typeof newAttrs === 'object') {
            for (key in newAttrs) {
                if (key.charCodeAt(0) !== 95 /* _ */) {
                    setter[propName + DELIMETER + key] = newAttrs[key];
                }
            }
        }
        else if (CC_DEV) {
            cc.errorID(3629);
        }
    }
}

function getClassAttrs (ctor) {
    return ctor.__attrs__ || createAttrs(ctor);
}

function setClassAttr (ctor, propName, key, value) {
    var attrs = ctor.__attrs__ || createAttrs(ctor);
    attrs.constructor.prototype[propName + DELIMETER + key] = value;
}

/**
 * @module cc
 */

/**
 * Specify that the input value must be integer in Inspector.
 * Also used to indicates that the elements in array should be type integer.
 * @property {string} Integer
 * @readonly
 */
cc.Integer = 'Integer';

/**
 * Indicates that the elements in array should be type double.
 * @property {string} Float
 * @readonly
 */
cc.Float = 'Float';

if (CC_EDITOR) {
    JS.get(cc, 'Number', function () {
        cc.warnID(3603);
        return cc.Float;
    });
}

/**
 * Indicates that the elements in array should be type boolean.
 * @property {string} Boolean
 * @readonly
 */
cc.Boolean = 'Boolean';

/**
 * Indicates that the elements in array should be type string.
 * @property {string} String
 * @readonly
 */
cc.String = 'String';

/*
BuiltinAttributes: {
    default: defaultValue,
    _canUsedInGetter: true, (default true)
    _canUsedInSetter: false, (default false) (NYI)
}
Getter or Setter: {
    hasGetter: true,
    hasSetter: true,
}
Callbacks: {
    _onAfterProp: function (constructor, propName) {},
    _onAfterGetter: function (constructor, propName) {}, (NYI)
    _onAfterSetter: function (constructor, propName) {}, (NYI)
}
 */

var NonSerialized = {
    serializable: false,
    _canUsedInGetter: false
};

var EditorOnly = {
    editorOnly: true,
    _canUsedInGetter: false
};

function getTypeChecker (type, attrName) {
    if (CC_DEV) {
        return function (constructor, mainPropName) {
            var propInfo = '"' + JS.getClassName(constructor) + '.' + mainPropName + '"';
            var mainPropAttrs = attr(constructor, mainPropName);
            if (!mainPropAttrs.saveUrlAsAsset) {
                var mainPropAttrsType = mainPropAttrs.type;
                if (mainPropAttrsType === cc.Integer || mainPropAttrsType === cc.Float) {
                    mainPropAttrsType = 'Number';
                }
                if (mainPropAttrsType !== type) {
                    cc.warnID(3604, propInfo);
                    return;
                }
            }
            if (!mainPropAttrs.hasOwnProperty('default')) {
                return;
            }
            var defaultVal = mainPropAttrs.default;
            if (typeof defaultVal === 'undefined') {
                return;
            }
            var isContainer = Array.isArray(defaultVal) || isPlainEmptyObj(defaultVal);
            if (isContainer) {
                return;
            }
            var defaultType = typeof defaultVal;
            var type_lowerCase = type.toLowerCase();
            if (defaultType === type_lowerCase) {
                if (!mainPropAttrs.saveUrlAsAsset) {
                    if (type_lowerCase === 'object') {
                        if (defaultVal && !(defaultVal instanceof mainPropAttrs.ctor)) {
                            cc.warnID(3605, propInfo, JS.getClassName(mainPropAttrs.ctor));
                        }
                        else {
                            return;
                        }
                    }
                    else if (type !== 'Number') {
                        cc.warnID(3606, attrName, propInfo, type);
                    }
                }
            }
            else if (defaultType !== 'function') {
                if (type === cc.String && defaultVal == null) {
                    if (!cc.isChildClassOf(mainPropAttrs.ctor, cc.RawAsset)) {
                        cc.warnID(3607, propInfo);
                    }
                }
                else if (mainPropAttrs.ctor === String && (defaultType === 'string' || defaultVal == null)) {
                    mainPropAttrs.type = cc.String;
                    cc.warnID(3608, propInfo);
                }
                else if (mainPropAttrs.ctor === Boolean && defaultType === 'boolean') {
                    mainPropAttrs.type = cc.Boolean;
                    cc.warnID(3609, propInfo);
                }
                else if (mainPropAttrs.ctor === Number && defaultType === 'number') {
                    mainPropAttrs.type = cc.Float;
                    cc.warnID(3610, propInfo);
                }
                else {
                    cc.warnID(3611, attrName, propInfo, defaultType);
                }
            }
            else {
                return;
            }
            delete mainPropAttrs.type;
        };
    }
}

function ObjectType (typeCtor) {
    return {
        type: 'Object',
        ctor: typeCtor,
        _onAfterProp: CC_DEV && function (classCtor, mainPropName) {
            getTypeChecker('Object', 'type')(classCtor, mainPropName);
            // check ValueType
            var defaultDef = getClassAttrs(classCtor)[mainPropName + DELIMETER + 'default'];
            var defaultVal = defaultDef;
            if (typeof defaultDef === 'function') {
                try {
                    defaultVal = defaultDef();
                }
                catch (e) {
                    return;
                }
            }
            if (!Array.isArray(defaultVal) && cc.isChildClassOf(typeCtor, cc.ValueType)) {
                var typename = JS.getClassName(typeCtor);
                var info = cc.js.formatStr('No need to specify the "type" of "%s.%s" because %s is a child class of ValueType.',
                    JS.getClassName(classCtor), mainPropName, typename);
                if (defaultDef) {
                    cc.log(info);
                }
                else {
                    cc.warnID(3612,
                        info, typename, JS.getClassName(classCtor), mainPropName, typename);
                }
            }
        }
    };
}

function RawType (typename) {
    var NEED_EXT_TYPES = ['image', 'json', 'text', 'audio'];  // the types need to specify exact extname
    return {
        // type: 'raw',
        rawType: typename,
        serializable: false,
        // hideInInspector: true,
        _canUsedInGetter: false,

        _onAfterProp: function (constructor, mainPropName) {
            // check raw object
            var checked = !CC_DEV || (function checkRawType(constructor) {
                if (! cc.isChildClassOf(constructor, cc.Asset)) {
                    cc.errorID(3630);
                    return false;
                }
                var attrs = getClassAttrs(constructor);
                var found = false;
                for (var p = 0; p < constructor.__props__.length; p++) {
                    var propName = constructor.__props__[p];
                    var rawType = attrs[propName + DELIMETER + 'rawType'];
                    if (rawType) {
                        var containsUppercase = (rawType.toLowerCase() !== rawType);
                        if (containsUppercase) {
                            cc.errorID(3631);
                            return false;
                        }
                        if (found) {
                            cc.errorID(3632);
                            return false;
                        }
                        found = true;
                    }
                }
                return true;
            })(constructor);
        }
    };
}

module.exports = {
    attr: attr,
    getClassAttrs: getClassAttrs,
    setClassAttr: setClassAttr,
    DELIMETER: DELIMETER,
    getTypeChecker: getTypeChecker,
    NonSerialized: NonSerialized,
    EditorOnly: EditorOnly,
    ObjectType: ObjectType,
    RawType: RawType,
    ScriptUuid: {},      // the value will be represented as a uuid string
};
