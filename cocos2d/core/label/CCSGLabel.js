/*global cc */

/****************************************************************************
 Copyright (c) 2015 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

var EventTarget = require("../cocos2d/core/event/event-target");
var JS = require("../cocos2d/core/platform/js");

var FntLoader = {
    INFO_EXP: /info [^\n]*(\n|$)/gi,
    COMMON_EXP: /common [^\n]*(\n|$)/gi,
    PAGE_EXP: /page [^\n]*(\n|$)/gi,
    CHAR_EXP: /char [^\n]*(\n|$)/gi,
    KERNING_EXP: /kerning [^\n]*(\n|$)/gi,
    ITEM_EXP: /\w+=[^ \r\n]+/gi,
    INT_EXP: /^[\-]?\d+$/,

    _parseStrToObj: function (str) {
        var arr = str.match(this.ITEM_EXP);
        var obj = {};
        if (arr) {
            for (var i = 0, li = arr.length; i < li; i++) {
                var tempStr = arr[i];
                var index = tempStr.indexOf("=");
                var key = tempStr.substring(0, index);
                var value = tempStr.substring(index + 1);
                if (value.match(this.INT_EXP)) value = parseInt(value);
                else if (value[0] === '"') value = value.substring(1, value.length - 1);
                obj[key] = value;
            }
        }
        return obj;
    },

    /**
     * Parse Fnt string.
     * @param fntStr
     * @returns {{}}
     */
    parseFnt: function (fntStr) {
        var self = this, fnt = {};
        //padding
        var infoResult = fntStr.match(self.INFO_EXP);
        if (!infoResult) return fnt;

        var infoObj = self._parseStrToObj(infoResult[0]);
        var paddingArr = infoObj["padding"].split(",");
        var padding = {
            left: parseInt(paddingArr[0]),
            top: parseInt(paddingArr[1]),
            right: parseInt(paddingArr[2]),
            bottom: parseInt(paddingArr[3])
        };

        //common
        var commonObj = self._parseStrToObj(fntStr.match(self.COMMON_EXP)[0]);
        fnt.commonHeight = commonObj["lineHeight"];
        fnt.fontSize = infoObj["size"];

        if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
            var texSize = cc.configuration.getMaxTextureSize();
            if (commonObj["scaleW"] > texSize.width || commonObj["scaleH"] > texSize.height)
                cc.log("cc.LabelBMFont._parseCommonArguments(): page can't be larger than supported");
        }
        if (commonObj["pages"] !== 1) cc.log("cc.LabelBMFont._parseCommonArguments(): only supports 1 page");

        //page
        var pageObj = self._parseStrToObj(fntStr.match(self.PAGE_EXP)[0]);
        if (pageObj["id"] !== 0) cc.log("cc.LabelBMFont._parseImageFileName() : file could not be found");
        fnt.atlasName = pageObj["file"];

        //char
        var charLines = fntStr.match(self.CHAR_EXP);
        var fontDefDictionary = fnt.fontDefDictionary = {};
        for (var i = 0, li = charLines.length; i < li; i++) {
            var charObj = self._parseStrToObj(charLines[i]);
            var charId = charObj["id"];
            fontDefDictionary[charId] = {
                rect: {x: charObj["x"], y: charObj["y"], width: charObj["width"], height: charObj["height"]},
                xOffset: charObj["xoffset"],
                yOffset: charObj["yoffset"],
                xAdvance: charObj["xadvance"]
            };
        }

        //kerning
        var kerningDict = fnt.kerningDict = {};
        var kerningLines = fntStr.match(self.KERNING_EXP);
        if (kerningLines) {
            for (i = 0, li = kerningLines.length; i < li; i++) {
                var kerningObj = self._parseStrToObj(kerningLines[i]);
                kerningDict[(kerningObj["first"] << 16) | (kerningObj["second"] & 0xffff)] = kerningObj["amount"];
            }
        }
        return fnt;
    }
};

var FontLetterDefinition = function() {
    this._u = 0;
    this._v = 0;
    this._width = 0;
    this._height = 0;
    this._offsetX = 0;
    this._offsetY = 0;
    this._textureID = 0;
    this._validDefinition = false;
    this._xAdvance = 0;
};

cc.FontAtlas = function(fntConfig) {
    this._lineHeight = fntConfig.commonHeight;
    this._fontSize = fntConfig.fontSize;
    this._letterDefinitions = {};
    this._fntConfig = fntConfig;
};

cc.FontAtlas.prototype = {
    constructor: cc.FontAtlas,
    setFontSize: function(fontSize) {
        this._fontSize = fontSize;
    },
    getOriginalFontSize: function() {
        return this._fntConfig.fontSize;
    },
    addLetterDefinitions: function(letter, letterDefinition) {
        this._letterDefinitions[letter] = letterDefinition;
    },
    cloneLetterDefinition: function() {
        var copyLetterDefinitions = {};
        for (var key in this._letterDefinitions) {
            var value = new FontLetterDefinition();
            cc.js.mixin(value, this._letterDefinitions[key]);
            copyLetterDefinitions[key] = value;
        }
        return copyLetterDefinitions;
    },
    assignLetterDefinitions: function(letterDefinition) {
        for (var key in this._letterDefinitions) {
            var newValue = letterDefinition[key];
            var oldValue = this._letterDefinitions[key];
            cc.js.mixin(oldValue, newValue);
        }
    },
    scaleFontLetterDefinition: function(scaleFactor) {
        for (var fontDefinition in this._letterDefinitions) {
            var letterDefinitions = this._letterDefinitions[fontDefinition];
            letterDefinitions._width *= scaleFactor;
            letterDefinitions._height *= scaleFactor;
            letterDefinitions._offsetX *= scaleFactor;
            letterDefinitions._offsetY *= scaleFactor;
            letterDefinitions._xAdvance *= scaleFactor;
        }
    },

    getLetterDefinitionForChar: function(char) {
        var hasKey = this._letterDefinitions.hasOwnProperty(char.charCodeAt(0));
        var letterDefinition;
        if (hasKey) {
            letterDefinition = this._letterDefinitions[char.charCodeAt(0)];
        } else {
            letterDefinition = null;
        }
        return letterDefinition;
    }
};

var LetterInfo = function() {
    this._char = '';
    this._valid = true;
    this._positionX = 0;
    this._positionY = 0;
    this._atlasIndex = 0;
    this._lineIndex = 0;
};

_ccsg.Label = _ccsg.Node.extend({
    _hAlign: cc.TextAlignment.LEFT, //0 left, 1 center, 2 right
    _vAlign: cc.VerticalTextAlignment.TOP, //0 bottom,1 center, 2 top
    _string: "",
    _fontSize: 40,
    _drawFontsize: 40,
    _overFlow: 0, //see _ccsg.Label.Overflow
    _isWrapText: true,
    _spacingX: 0,

    _blendFunc: null,
    _labelType: 0, //0 is ttf, 1 is bmfont.
    _fontHandle: "", //a ttf font name or a bmfont file path.
    _lineSpacing: 0,

    _maxLineWidth:  0,
    _labelDimensions:  cc.size(0, 0),
    _labelWidth:  0,
    _labelHeight:  0,

    _lineHeight: 40,
    _outlined: false,
    _outlineColor: null,
    _outlineWidth: 1,
    _gradientEnabled: false,
    _gradientStartColor: cc.color(255, 255, 255, 255),
    _gradientEndColor: cc.color(255, 255, 255, 255),
    _gradientDirection: 0,
    _className: "Label",
    //used for left and right margin
    _margin : 0,
    //bold,italic, underline
    _isBold: false,
    _isItalic: false,
    _isUnderline: false,
    _fontAsset: null,

    //fontHandle it is a system font name, ttf file path or bmfont file path.
    ctor: function(string, fontAsset) {
        EventTarget.call(this);
        var isAsset = fontAsset instanceof cc.Font;
        var fontHandle =  isAsset ? fontAsset.rawUrl : '';

        this._fontHandle = fontHandle;
        if (typeof string !== 'string') {
            string = '' + string;
        }

        this._string = string;

        _ccsg.Node.prototype.ctor.call(this);
        this.setAnchorPoint(0.5, 0.5);
        _ccsg.Node.prototype.setContentSize.call(this, 128, 128);
        this._blendFunc = cc.BlendFunc._alphaNonPremultiplied();

        this._imageOffset = cc.p(0, 0);
        this._numberOfLines = 0;
        this._lettersInfo = [];
        this._linesWidth = [];
        this._linesOffsetX = [];
        this._horizontalKernings = [];
        this._reusedRect =  cc.rect(0, 0, 0, 0);
        if (isAsset) {
            this.setFontAsset(fontAsset);
        } else {
            this.setFontFamily(fontHandle);
        }
        this.setString(this._string);
    },

    _resetBMFont: function() {
        this._imageOffset.x = this._imageOffset.y = 0;
        this._cascadeColorEnabled = true;
        this._cascadeOpacityEnabled = true;
        this._fontAtlas = null;
        this._config = null;
        this._numberOfLines =  0;
        this._lettersInfo.length = 0;
        this._linesWidth.length = 0;
        this._linesOffsetX.length = 0;
        this._textDesiredHeight =  0;
        this._letterOffsetY =  0;
        this._tailoredTopY =  0;
        this._tailoredBottomY =  0;
        this._bmfontScale =  1.0;
        this._horizontalKernings.length = 0;
        this._lineBreakWithoutSpaces =  false;

        this._reusedRect.x = this._reusedRect.y = this._reusedRect.width = this._reusedRect.height = 0;
        this._textureLoaded = false;

        if (this._spriteBatchNode) {
            this.removeChild(this._spriteBatchNode);
            this._spriteBatchNode = null;
        }
    },

    setHorizontalAlign: function(align) {
        if (this._hAlign === align) return;

        this._hAlign = align;
        this._notifyLabelSkinDirty();
    },

    getHorizontalAlign: function() {
        return this._hAlign;
    },

    setVerticalAlign: function(align) {
        if (this._vAlign === align) return;

        this._vAlign = align;
        this._notifyLabelSkinDirty();
    },

    getVerticalAlign: function() {
        return this._vAlign;
    },

    setString: function(string) {
        //convert param to string
        if (typeof string !== 'string') {
            string = '' + string;
        }

        if (this._string === string) return;

        this._string = string;
        this._notifyLabelSkinDirty();
    },

    setMargin: function(value) {
        if(this._margin === value) return;

        this._margin = value;
        this._notifyLabelSkinDirty();
    },

    getString: function() {
        return this._string;
    },
    getStringLength: function() {
        return this._string.length;
    },

    enableWrapText: function(enabled) {
        if (this._isWrapText === enabled) return;

        //when label is in resize mode, wrap is disabled.
        if (this._overFlow === _ccsg.Label.Overflow.RESIZE_HEIGHT ||
           this._overFlow === _ccsg.Label.Overflow.NONE) {
            return;
        }
        this._isWrapText = enabled;
        this._rescaleWithOriginalFontSize();

        this._notifyLabelSkinDirty();
    },

    enableItalics: function (enabled) {
        this._isItalic = enabled;
        if(enabled) {
            this.setSkewX(12);
        } else {
            this.setSkewX(0);
        }
    },

    enableBold: function (enabled) {
        if(this._isBold === enabled) return;

        this._isBold = enabled;
        this._notifyLabelSkinDirty();
    },

    enableUnderline: function (enabled) {
        if(this._isUnderline === enabled) return;

        this._isUnderline = enabled;
        this._notifyLabelSkinDirty();
    },

    isWrapTextEnabled: function() {
        return this._isWrapText;
    },
    getFontName: function() {
        return this._fontHandle;
    },
    setFontSize: function(fntSize) {
        if(this._fontSize === fntSize) return;

        this._fontSize = fntSize;
        this._drawFontsize = fntSize;
        this._notifyLabelSkinDirty();
    },

    getFontSize: function() {
        return this._fontSize;
    },

    isOutlined: function() {
        return this._outlined;
    },

    setOutlined: function(value) {
        if(this._outlined === value) return;

        this._outlined = !!value;
        this._notifyLabelSkinDirty();
    },

    setFillColorGradientEnabled: function(value) {
        if(this._gradientEnabled === value) return;

        this._gradientEnabled = !!value;
        this._notifyLabelSkinDirty();
    },
    getFillColorGradientEnabled: function () {
        return this._gradientEnabled;
    },

    setGradientStartColor: function (value) {
        if(this._gradientStartColor === value) return;
        this._gradientStartColor = value;
        this._notifyLabelSkinDirty();
    },

    getGradientStartColor: function () {
        return this._gradientStartColor;
    },

    setGradientEndColor: function (value) {
        if(this._gradientEndColor === value) return;
        this._gradientEndColor = value;
        this._notifyLabelSkinDirty();
    },

    getGradientEndColor: function () {
        return this._gradientEndColor;
    },

    setFillColorGradientDirection: function (direction) {
        this._gradientDirection = direction;
        this._notifyLabelSkinDirty();
    },

    getFillColorGradientDirection: function () {
        return this._gradientDirection;
    },

    getOutlineColor: function() {
        return this._outlineColor;
    },

    setOutlineColor: function(value) {
        if(this._outlineColor === value) return;

        this._outlineColor = cc.color(value);
        this._notifyLabelSkinDirty();
    },

    setOutlineWidth: function(value) {
        if(this._outlineWidth === value) return;

        this._outlineWidth = value;
        this._notifyLabelSkinDirty();
    },

    getOutlineWidth: function() {
        return this._outlineWidth;
    },

    _updateWrapText: function(overflow){
        if ( overflow === _ccsg.Label.Overflow.RESIZE_HEIGHT) {
            this._isWrapText = true;
        }

        if (overflow === _ccsg.Label.Overflow.NONE) {
            this._isWrapText = false;
        }
    },


    _setOverflowBMFont: function () {
        if (this._labelType === _ccsg.Label.Type.BMFont) {

            if ( this._overFlow === _ccsg.Label.Overflow.RESIZE_HEIGHT) {
                this._setDimensions(this._labelDimensions.width, 0);
            }

            if (this._overFlow === _ccsg.Label.Overflow.NONE) {
                this._setDimensions(0, 0);
            }

            this._rescaleWithOriginalFontSize();
        }
    },

    setOverflow: function(overflow) {
        if (this._overFlow === overflow) return;

        this._overFlow = overflow;

        this._updateWrapText(this._overFlow);

        this._setOverflowBMFont();

        this._notifyLabelSkinDirty();
    },

    getOverflow: function() {
        return this._overFlow;
    },

    setSpacingX: function(spacing) {
        if (this._spacingX === spacing) return;
        this._spacingX = spacing;
        this._notifyLabelSkinDirty();
    },

    setLineHeight: function(lineHeight) {
        if (this._lineHeight === lineHeight) return;

        this._lineHeight = lineHeight;
        this._notifyLabelSkinDirty();
    },
    setLineBreakWithoutSpace: function(lineBreakFlag) {
        if (this._lineBreakWithoutSpaces === lineBreakFlag) return;

        this._lineBreakWithoutSpaces = lineBreakFlag;
        this._notifyLabelSkinDirty();
    },
    getSpacingX: function() {
        return this._spacingX;
    },

    getLineHeight: function() {
        return this._lineHeight;
    },

    getBMFontLineHeight : function() {
        if(this._fontAtlas) {
            return this._fontAtlas._lineHeight;
        }
    },

    setFontFamily: function (fontFamily) {
        this._fontHandle = fontFamily || "Arial";
        this._labelType = _ccsg.Label.Type.SystemFont;
        this._blendFunc = cc.BlendFunc._alphaPremultiplied();
        this._renderCmd._needDraw = true;
        this._notifyLabelSkinDirty();
        this.emit('load');
    },

    setFontAsset: function(fontAsset) {
        this._fontAsset = fontAsset;
        var isAsset = fontAsset instanceof cc.Font;
        if (!isAsset) {
            this.setFontFamily('');
            return;
        }
        var fontHandle =  isAsset ? fontAsset.rawUrl : '';
        var extName = cc.path.extname(fontHandle);

        this._resetBMFont();

        if (extName === ".ttf") {
            this._labelType = _ccsg.Label.Type.TTF;
            this._blendFunc = cc.BlendFunc._alphaPremultiplied();
            this._renderCmd._needDraw = true;
            this._fontHandle = this._loadTTFFont(fontHandle);
        } else if (fontAsset.spriteFrame) {
            //todo add bmfont here
            this._labelType = _ccsg.Label.Type.BMFont;
            this._blendFunc = cc.BlendFunc._alphaNonPremultiplied();
            this._renderCmd._needDraw = false;
            this._initBMFontWithString(this._string, fontAsset);
        }
        this._notifyLabelSkinDirty();
    },

    _loadTTFFont: function(fontHandle) {
        var self = this;

        var fontFamilyName = cc.CustomFontLoader._getFontFamily(fontHandle);
        var callback = function () {
            self._notifyLabelSkinDirty();
            self.emit('load');
        };
        cc.CustomFontLoader.loadTTF(fontHandle, callback);

        return fontFamilyName;
    },

    setContentSize: function(size, height) {
        if (this._overFlow === _ccsg.Label.Overflow.NONE) {
            return;
        }

        this._setDimensions(size, height);
    },

    setBlendFunc: function(src, dst) {
        var locBlendFunc = this._blendFunc;
        if (dst === undefined) {
            locBlendFunc.src = src.src;
            locBlendFunc.dst = src.dst;
        } else {
            locBlendFunc.src = src;
            locBlendFunc.dst = dst;
        }
    },


    getBlendFunc: function() {
        return new cc.BlendFunc(this._blendFunc.src, this._blendFunc.dst);
    },

    _setupBMFontOverflowMetrics: function(newWidth, newHeight) {
        if (this._overFlow === _ccsg.Label.Overflow.RESIZE_HEIGHT) {
            newHeight = 0;
        }

        if (this._overFlow === _ccsg.Label.Overflow.NONE) {
            newWidth = 0;
            newHeight = 0;
        }

        this._labelWidth = newWidth;
        this._labelHeight = newHeight;
        this._labelDimensions.width = newWidth;
        this._labelDimensions.height = newHeight;
        this._maxLineWidth = newWidth;
    },

    _updateLabel: function () {
        if (this._labelType === _ccsg.Label.Type.BMFont) {
            var contentSize = this._contentSize;
            var newWidth = contentSize.width;
            var newHeight = contentSize.height;
            this._setupBMFontOverflowMetrics(newWidth, newHeight);

            this._updateContent();
            this.setColor(this.color);
        } else if (this._labelType === _ccsg.Label.Type.TTF
                   || this._labelType === _ccsg.Label.Type.SystemFont) {
            this._renderCmd._bakeLabel();
        }
    },

    _notifyLabelSkinDirty: function() {
        if (CC_EDITOR) {
            this._updateLabel();
        } else {
            this._renderCmd.setDirtyFlag(_ccsg.Node._dirtyFlags.textDirty
                                         |_ccsg.Node._dirtyFlags.contentDirty);
        }
    },
    _createRenderCmd: function() {
        if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
            return new _ccsg.Label.WebGLRenderCmd(this);
        } else {
            return new _ccsg.Label.CanvasRenderCmd(this);
        }
    },

    getContentSize: function() {
        var locFlag = this._renderCmd._dirtyFlag;
        if (locFlag & _ccsg.Node._dirtyFlags.textDirty) {
            this._updateLabel();
            this._renderCmd._dirtyFlag &= ~_ccsg.Node._dirtyFlags.textDirty;
        }
        return _ccsg.Node.prototype.getContentSize.call(this);
    },
    _getWidth: function () {
        var locFlag = this._renderCmd._dirtyFlag;
        if (locFlag & _ccsg.Node._dirtyFlags.textDirty) {
            this._updateLabel();
            this._renderCmd._dirtyFlag &= ~_ccsg.Node._dirtyFlags.textDirty;
        }
        return _ccsg.Node.prototype._getWidth.call(this);
    },
    _getHeight: function () {
        var locFlag = this._renderCmd._dirtyFlag;
        if (locFlag & _ccsg.Node._dirtyFlags.textDirty) {
            this._updateLabel();
            this._renderCmd._dirtyFlag &= ~_ccsg.Node._dirtyFlags.textDirty;
        }
        return _ccsg.Node.prototype._getHeight.call(this);
    },
    _alignText: function() {
        var ret = true;

        do {
            if (!this._spriteBatchNode) return true;


            this._textDesiredHeight = 0;
            this._linesWidth = [];
            if (!this._lineBreakWithoutSpaces) {
                this._multilineTextWrapByWord();
            } else {
                this._multilineTextWrapByChar();
            }

            this._computeAlignmentOffset();

            //shrink
            if (this._overFlow === _ccsg.Label.Overflow.SHRINK) {
                var fontSize = this.getFontSize();

                if (fontSize > 0 && this._isVerticalClamp()) {
                    this._shrinkLabelToContentSize(this._isVerticalClamp.bind(this));
                }
            }

            if (!this._updateQuads()) {
                ret = false;
                if (this._overFlow === _ccsg.Label.Overflow.SHRINK) {
                    this._shrinkLabelToContentSize(this._isHorizontalClamp.bind(this));
                }
                break;
            }
        } while (0);

        return ret;
    },

    _isHorizontalClamped : function(px, lineIndex){
        var wordWidth = this._linesWidth[lineIndex];
        var letterOverClamp = (px > this._contentSize.width || px < 0);

        if(!this._isWrapText){
            return letterOverClamp;
        }else{
            return (wordWidth > this._contentSize.width && letterOverClamp);
        }
    },

    _updateQuads: function() {
        var ret = true;

        this._spriteBatchNode.removeAllChildren();
        for (var ctr = 0; ctr < this._string.length; ++ctr) {
            if (this._lettersInfo[ctr]._valid) {
                var letterDef = this._fontAtlas._letterDefinitions[this._lettersInfo[ctr]._char];

                this._reusedRect.height = letterDef._height;
                this._reusedRect.width = letterDef._width;
                this._reusedRect.x = letterDef._u;
                this._reusedRect.y = letterDef._v;

                var py = this._lettersInfo[ctr]._positionY + this._letterOffsetY;

                if (this._labelHeight > 0) {
                    if (py > this._tailoredTopY) {
                        var clipTop = py - this._tailoredTopY;
                        this._reusedRect.y += clipTop;
                        this._reusedRect.height -= clipTop;
                        py = py - clipTop;
                    }

                    if (py - letterDef._height * this._bmfontScale < this._tailoredBottomY) {
                        this._reusedRect.height = (py < this._tailoredBottomY) ? 0 : (py - this._tailoredBottomY);
                    }
                }

                var lineIndex = this._lettersInfo[ctr]._lineIndex;
                var px = this._lettersInfo[ctr]._positionX + letterDef._width / 2 * this._bmfontScale + this._linesOffsetX[lineIndex];


                if (this._labelWidth > 0) {
                    if (this._isHorizontalClamped(px, lineIndex)) {
                        if (this._overFlow === _ccsg.Label.Overflow.CLAMP) {
                            this._reusedRect.width = 0;
                        } else if (this._overFlow === _ccsg.Label.Overflow.SHRINK) {
                            if (this._contentSize.width > letterDef._width) {
                                ret = false;
                                break;
                            } else {
                                this._reusedRect.width = 0;
                            }
                        }
                    }
                }


                if (this._reusedRect.height > 0 && this._reusedRect.width > 0) {
                    var fontChar = this.getChildByTag(ctr);
                    var locTexture = this._spriteBatchNode._texture;
                    var spriteFrame = this._spriteFrame;

                    var isRotated = this._spriteFrame.isRotated();

                    var originalSize = spriteFrame._originalSize;
                    var rect = spriteFrame._rect;
                    var offset = spriteFrame._offset;
                    var trimmedLeft = offset.x + (originalSize.width - rect.width) / 2;
                    var trimmedTop = offset.y - (originalSize.height - rect.height) / 2;


                    if(!isRotated) {
                        this._reusedRect.x += (rect.x - trimmedLeft);
                        this._reusedRect.y += (rect.y + trimmedTop);
                    } else {
                        var originalX = this._reusedRect.x;
                        this._reusedRect.x = rect.x + rect.height - this._reusedRect.y - this._reusedRect.height - trimmedTop;
                        this._reusedRect.y = originalX + rect.y - trimmedLeft;
                        if (this._reusedRect.y < 0) {
                            this._reusedRect.height = this._reusedRect.height + trimmedTop;
                        }
                    }

                    if (!fontChar) {
                        fontChar = new _ccsg.Sprite();
                        fontChar.initWithTexture(locTexture, this._reusedRect, isRotated);
                        fontChar.setAnchorPoint(cc.p(0, 1));
                    } else {
                        fontChar.setTextureRect(this._reusedRect, isRotated);
                    }


                    var letterPositionX = this._lettersInfo[ctr]._positionX + this._linesOffsetX[this._lettersInfo[ctr]._lineIndex];
                    fontChar.setPosition(letterPositionX, py);

                    var index = this._spriteBatchNode.getChildrenCount();

                    this._lettersInfo[ctr]._atlasIndex = index;

                    this._updateLetterSpriteScale(fontChar);

                    this._spriteBatchNode.addChild(fontChar);

                }
            }
        }

        return ret;
    },

    _updateLetterSpriteScale: function(sprite) {
        if (this._labelType === _ccsg.Label.Type.BMFont && this._fontSize > 0) {
            sprite.setScale(this._bmfontScale);
        }
    },

    _recordPlaceholderInfo: function(letterIndex, char) {
        if (letterIndex >= this._lettersInfo.length) {
            var tmpInfo = new LetterInfo();
            this._lettersInfo.push(tmpInfo);
        }

        this._lettersInfo[letterIndex]._char = char;
        this._lettersInfo[letterIndex]._valid = false;
    },

    _recordLetterInfo: function(letterPosition, character, letterIndex, lineIndex) {
        if (letterIndex >= this._lettersInfo.length) {
            var tmpInfo = new LetterInfo();
            this._lettersInfo.push(tmpInfo);
        }
        character = character.charCodeAt(0);

        this._lettersInfo[letterIndex]._lineIndex = lineIndex;
        this._lettersInfo[letterIndex]._char = character;
        this._lettersInfo[letterIndex]._valid = this._fontAtlas._letterDefinitions[character]._validDefinition;
        this._lettersInfo[letterIndex]._positionX = letterPosition.x;
        this._lettersInfo[letterIndex]._positionY = letterPosition.y;
    },

    _setDimensions: function(size, height) {
        var newWidth = (typeof size.width === 'number') ? size.width : size;
        var newHeight = (typeof size.height === 'number') ? size.height : height;

        var oldSize = this.getContentSize();
        _ccsg.Node.prototype.setContentSize.call(this, size, height);

        if (newHeight !== oldSize.height || newWidth !== oldSize.width) {

            this._setupBMFontOverflowMetrics(newWidth, newHeight);

            if (this._drawFontsize > 0) {
                this._restoreFontSize();
            }

            this._notifyLabelSkinDirty();
        }
    },

    _restoreFontSize: function() {
        this._fontSize = this._drawFontsize;
    },

    _multilineTextWrap: function(nextTokenFunc) {
        var textLen = this.getStringLength();
        var lineIndex = 0;
        var nextTokenX = 0;
        var nextTokenY = 0;
        var longestLine = 0;
        var letterRight = 0;

        var lineSpacing = this._lineSpacing;
        var highestY = 0;
        var lowestY = 0;
        var letterDef = null;
        var letterPosition = cc.p(0, 0);

        this._updateBMFontScale();

        for (var index = 0; index < textLen;) {
            var character = this._string.charAt(index);
            if (character === "\n") {
                this._linesWidth.push(letterRight);
                letterRight = 0;
                lineIndex++;
                nextTokenX = 0;
                nextTokenY -= this._lineHeight * this._bmfontScale + lineSpacing;
                this._recordPlaceholderInfo(index, character);
                index++;
                continue;
            }

            var tokenLen = nextTokenFunc(this._string, index, textLen);
            var tokenHighestY = highestY;
            var tokenLowestY = lowestY;
            var tokenRight = letterRight;
            var nextLetterX = nextTokenX;
            var newLine = false;

            for (var tmp = 0; tmp < tokenLen; ++tmp) {
                var letterIndex = index + tmp;
                character = this._string.charAt(letterIndex);
                if (character === "\r") {
                    this._recordPlaceholderInfo(letterIndex, character);
                    continue;
                }
                letterDef = this._fontAtlas.getLetterDefinitionForChar(character);
                if (!letterDef) {
                    this._recordPlaceholderInfo(letterIndex, character);
                    console.log("Can't find letter definition in texture atlas " + this._config.atlasName + " for letter:" + character);
                    continue;
                }

                var letterX = nextLetterX + letterDef._offsetX * this._bmfontScale;

                if (this._isWrapText
                    && this._maxLineWidth > 0
                    && nextTokenX > 0
                    && letterX + letterDef._width * this._bmfontScale > this._maxLineWidth
                    && !cc.TextUtils.isUnicodeSpace(character)) {
                    this._linesWidth.push(letterRight);
                    letterRight = 0;
                    lineIndex++;
                    nextTokenX = 0;
                    nextTokenY -= (this._lineHeight * this._bmfontScale + lineSpacing);
                    newLine = true;
                    break;
                } else {
                    letterPosition.x = letterX;
                }

                letterPosition.y = nextTokenY - letterDef._offsetY * this._bmfontScale;
                this._recordLetterInfo(letterPosition, character, letterIndex, lineIndex);

                if (letterIndex + 1 < this._horizontalKernings.length && letterIndex < textLen - 1) {
                    nextLetterX += this._horizontalKernings[letterIndex + 1];
                }

                nextLetterX += letterDef._xAdvance * this._bmfontScale + this._spacingX;

                tokenRight = letterPosition.x + letterDef._width * this._bmfontScale;

                if (tokenHighestY < letterPosition.y) {
                    tokenHighestY = letterPosition.y;
                }

                if (tokenLowestY > letterPosition.y - letterDef._height * this._bmfontScale) {
                    tokenLowestY = letterPosition.y - letterDef._height * this._bmfontScale;
                }

            } //end of for loop

            if (newLine) continue;

            nextTokenX = nextLetterX;
            letterRight = tokenRight;

            if (highestY < tokenHighestY) {
                highestY = tokenHighestY;
            }
            if (lowestY > tokenLowestY) {
                lowestY = tokenLowestY;
            }
            if (longestLine < letterRight) {
                longestLine = letterRight;
            }

            index += tokenLen;
        } //end of for loop

        this._linesWidth.push(letterRight);

        this._numberOfLines = lineIndex + 1;
        this._textDesiredHeight = this._numberOfLines * this._lineHeight * this._bmfontScale;
        if (this._numberOfLines > 1) {
            this._textDesiredHeight += (this._numberOfLines - 1) * this._lineSpacing;
        }

        var contentSize = cc.size(this._labelWidth, this._labelHeight);
        if (this._labelWidth <= 0) {
            contentSize.width = parseFloat(longestLine.toFixed(2));
        }
        if (this._labelHeight <= 0) {
            contentSize.height = parseFloat(this._textDesiredHeight.toFixed(2));
        }

        _ccsg.Node.prototype.setContentSize.call(this, contentSize);

        this._tailoredTopY = contentSize.height;
        this._tailoredBottomY = 0;
        if (highestY > 0) {
            this._tailoredTopY = contentSize.height + highestY;
        }
        if (lowestY < -this._textDesiredHeight) {
            this._tailoredBottomY = this._textDesiredHeight + lowestY;
        }

        return true;
    },

    _multilineTextWrapByWord: function() {
        return this._multilineTextWrap(this._getFirstWordLen.bind(this));
    },

    _multilineTextWrapByChar: function() {
        return this._multilineTextWrap(this._getFirstCharLen.bind(this));
    },

    _isVerticalClamp: function() {
        if (this._textDesiredHeight > this._contentSize.height) {
            return true;
        } else {
            return false;
        }
    },

    _isHorizontalClamp: function() {
        var letterClamp = false;

        for (var ctr = 0; ctr < this.getStringLength(); ++ctr) {
            if (this._lettersInfo[ctr]._valid) {
                var letterDef = this._fontAtlas._letterDefinitions[this._lettersInfo[ctr]._char];

                var px = this._lettersInfo[ctr]._positionX + letterDef._width / 2 * this._bmfontScale;
                var lineIndex = this._lettersInfo[ctr]._lineIndex;
                if (this._labelWidth > 0) {
                    if (!this._isWrapText) {
                        if(px > this._contentSize.width){
                            letterClamp = true;
                            break;
                        }
                    }else{
                        var wordWidth = this._linesWidth[lineIndex];
                        if(wordWidth > this._contentSize.width && (px > this._contentSize.width || px < 0)){
                            letterClamp = true;
                            break;
                        }
                    }
                }
            }
        }

        return letterClamp;
    },

    _shrinkLabelToContentSize: function(lambda) {
        var fontSize = this.getFontSize();

        var i = 0;
        var tempLetterDefinition = this._fontAtlas.cloneLetterDefinition();
        var originalLineHeight = this._lineHeight;
        var flag = true;

        while (lambda()) {
            ++i;

            var newFontSize = fontSize - i;
            flag = false;
            if (newFontSize <= 0) {
                break;
            }

            var scale = newFontSize / fontSize;
            this._fontAtlas.assignLetterDefinitions(tempLetterDefinition);
            this._fontAtlas.scaleFontLetterDefinition(scale);
            this._lineHeight = originalLineHeight * scale;
            if (!this._lineBreakWithoutSpaces) {
                this._multilineTextWrapByWord();
            } else {
                this._multilineTextWrapByChar();
            }
            this._computeAlignmentOffset();
        }

        this._lineHeight = originalLineHeight;
        this._fontAtlas.assignLetterDefinitions(tempLetterDefinition);

        if (!flag) {
            if (fontSize - i >= 0) {
                this._scaleFontSizeDown(fontSize - i);
            }
        }
    },

    _scaleFontSizeDown: function(fontSize) {
        var shouldUpdateContent = true;
        if (this._labelType === _ccsg.Label.Type.BMFont) {
            if (!fontSize) {
                fontSize = 0.1;
                shouldUpdateContent = false;
            }
            this._fontSize = fontSize;

            if (shouldUpdateContent) {
                this._updateContent();
            }
        }
    },

    _updateContent: function() {
        if (this._fontAtlas) {
            this._computeHorizontalKerningForText(this._string);
            this._alignText();
        }
    },


    _computeAlignmentOffset: function() {
        this._linesOffsetX = [];
        switch (this._hAlign) {
            case cc.TextAlignment.LEFT:
                for (var i = 0; i < this._numberOfLines; ++i) {
                    this._linesOffsetX.push(0);
                }
                break;
            case cc.TextAlignment.CENTER:
                this._linesWidth.forEach(function(lineWidth) {
                    this._linesOffsetX.push((this._contentSize.width - lineWidth) / 2);
                }.bind(this));
                break;
            case cc.TextAlignment.RIGHT:
                this._linesWidth.forEach(function(lineWidth) {
                    this._linesOffsetX.push(this._contentSize.width - lineWidth);
                }.bind(this));
                break;
            default:
                break;
        }

        switch (this._vAlign) {
            case cc.VerticalTextAlignment.TOP:
                this._letterOffsetY = this._contentSize.height;
                break;
            case cc.VerticalTextAlignment.CENTER:
                this._letterOffsetY = (this._contentSize.height + this._textDesiredHeight) / 2;
                break;
            case cc.VerticalTextAlignment.BOTTOM:
                this._letterOffsetY = this._textDesiredHeight;
                break;
            default:
                break;
        }
    },

    _getFirstCharLen: function() {
        return 1;
    },

    _getFirstWordLen: function(text, startIndex, textLen) {
        var character = text.charAt(startIndex);
        if (cc.TextUtils.isUnicodeCJK(character)
            || character === "\n"
            || cc.TextUtils.isUnicodeSpace(character)) {
            return 1;
        }

        var len = 1;
        letterDef = this._fontAtlas.getLetterDefinitionForChar(character);
        if (!letterDef) {
            return len;
        }
        var nextLetterX = letterDef._xAdvance * this._bmfontScale + this._spacingX;
        var letterDef;
        var letterX;
        for (var index = startIndex + 1; index < textLen; ++index) {
            character = text.charAt(index);

            letterDef = this._fontAtlas.getLetterDefinitionForChar(character);
            if (!letterDef) {
                break;
            }
            letterX = nextLetterX + letterDef._offsetX * this._bmfontScale;

            if(letterX + letterDef._width * this._bmfontScale > this._maxLineWidth
               && !cc.TextUtils.isUnicodeSpace(character)
               && this._maxLineWidth > 0) {
                return len;
            }
            nextLetterX += letterDef._xAdvance * this._bmfontScale + this._spacingX;
            if (character === "\n"
                || cc.TextUtils.isUnicodeSpace(character)
                || cc.TextUtils.isUnicodeCJK(character)) {
                break;
            }
            len++;
        }

        return len;
    },

    _updateBMFontScale: function() {
        if (this._labelType === _ccsg.Label.Type.BMFont) {
            var originalFontSize = this._fontAtlas._fontSize;
            this._bmfontScale = this._fontSize / originalFontSize;
        } else {
            this._bmfontScale = 1;
        }

    },

    _initBMFontWithString: function(str, fontAsset) {
        var self = this;
        if (self._config) {
            cc.logID(4002);
            return false;
        }
        this._string = str;
        this._setBMFontFile(fontAsset);
    },

    _createSpriteBatchNode: function(texture) {

        this._spriteBatchNode = new cc.SpriteBatchNode(texture, this._string.length);
        this._spriteBatchNode.setCascadeColorEnabled(true);
        this._spriteBatchNode.setCascadeOpacityEnabled(true);
        this.addChild(this._spriteBatchNode);

        this._updateContent();
        this.setColor(this.color);
    },
    //this method is used as createFontAtlas
    _createFontChars: function() {
        if (!this._config) {
            return;
        }

        this._fontAtlas = new cc.FontAtlas(this._config);

        if(!this._lineHeight){
            this._lineHeight = this._fontAtlas._lineHeight;
        }

        var locCfg = this._config;
        var locFontDict = locCfg.fontDefDictionary;

        for (var fontDef in locFontDict) {
            var letterDefinition = new FontLetterDefinition();

            var tempRect = locFontDict[fontDef].rect;

            letterDefinition._offsetX = locFontDict[fontDef].xOffset;
            letterDefinition._offsetY = locFontDict[fontDef].yOffset;
            letterDefinition._width = tempRect.width;
            letterDefinition._height = tempRect.height;
            letterDefinition._u = tempRect.x + this._imageOffset.x;
            letterDefinition._v = tempRect.y + this._imageOffset.y;
            //FIXME: only one texture supported for now
            letterDefinition._textureID = 0;
            letterDefinition._validDefinition = true;
            letterDefinition._xAdvance = locFontDict[fontDef].xAdvance;

            this._fontAtlas.addLetterDefinitions(fontDef, letterDefinition);
        }
    },

    _rescaleWithOriginalFontSize: function() {
        var renderingFontSize = this.getFontSize();
        if (this._drawFontsize - renderingFontSize >= 1 && this._overFlow === _ccsg.Label.Overflow.SHRINK) {
            if(this._labelType === _ccsg.Label.Type.BMFont) {
                this._scaleFontSizeDown(this._drawFontsize);
            } else {
                this._fontSize = this._drawFontsize;
            }
        }
    },

    _computeHorizontalKerningForText: function() {
        var stringLen = this.getStringLength();
        var locKerningDict = this._config.kerningDict;

        var prev = -1;
        for (var i = 0; i < stringLen; ++i) {
            var key = this._string.charCodeAt(i);
            var kerningAmount = locKerningDict[(prev << 16) | (key & 0xffff)] || 0;
            if (i < stringLen - 1) {
                this._horizontalKernings[i] = kerningAmount;
            } else {
                this._horizontalKernings[i] = 0;
            }
            prev = key;
        }
    },

    _setBMFontFile: function(fontAsset) {
        if (fontAsset) {
            if (this._labelType === _ccsg.Label.Type.BMFont) {
                var self = this;
                this._resetBMFont();

                this._fontAsset._fntConfig = FntLoader.parseFnt(this._fontAsset.fntDataStr);
                var fntConfig = this._fontAsset._fntConfig;
                if (fntConfig) {
                    self._config = fntConfig;
                } else {
                    cc.warn('Invalid BMFont Assets!');
                }
                var spriteFrame = fontAsset.spriteFrame;
                self._createFontChars();
                self._spriteFrame = spriteFrame;

                var createLabelSprites = function () {
                    var texture = spriteFrame.getTexture();
                    self._textureLoaded = texture.isLoaded();
                    self._createSpriteBatchNode(texture);
                    self.emit("load");
                };

                if (spriteFrame.textureLoaded()) {
                    createLabelSprites();
                } else {
                    spriteFrame.once('load', createLabelSprites);
                    spriteFrame.ensureLoadTexture();
                }
            }
        }
    }
});

_ccsg.Label.pool = new JS.Pool(function (label) {
    if (CC_EDITOR || !(label instanceof _ccsg.Label)) {
        return false;
    }
    label._string = "";
    label._fontAsset = null;
    label._fontHandle = "";
    label._labelType = 0;
    label._resetBMFont();
    label._renderCmd._labelCanvas.width = 1;
    label._renderCmd._labelCanvas.height = 1;
    if (CC_DEV) {
        cc.assert(!label._parent, 'Recycling label\'s parent should be null!');
    }
    label._updateLabel();
    return true;
}, 120);

_ccsg.Label.pool.get = function (string, fontAsset) {
    var label = this._get();
    if (label) {
        var isAsset = fontAsset instanceof cc.Font;
        var fontHandle =  isAsset ? fontAsset.rawUrl : '';
        label._fontHandle = fontHandle;
        if (typeof string !== 'string') {
            string = '' + string;
        }
        label._string = string;

        label._position.x = 0;
        label._position.y = 0;
        label.setAnchorPoint(0.5, 0.5);
        _ccsg.Node.prototype.setContentSize.call(label, 128, 128);

        if (isAsset) {
            label.setFontAsset(fontAsset);
        } else {
            label.setFontFamily("Arial");
        }

        label.setString(string);
        label.setHorizontalAlign(cc.TextAlignment.LEFT);
        label.setVerticalAlign(cc.VerticalTextAlignment.TOP);
        label.setFontSize(40);
        label.setOverflow(0);
        label.enableWrapText(true);
        label.setVisible(true);
        label.setLineHeight(40);
        label.setOutlined(false);
        label.enableBold(false);
        label.enableItalics(false);
        label.enableUnderline(false);

        return label;
    }
    else {
        return new _ccsg.Label(string || "", fontAsset);
    }
};


var _p = _ccsg.Label.prototype;
cc.js.addon(_p, EventTarget.prototype);

_ccsg.Label.Type = cc.Enum({
    TTF: 0,
    BMFont: 1,
    SystemFont: 2
});
_ccsg.Label.Overflow = cc.Enum({
    NONE: 0,
    CLAMP: 1,
    SHRINK: 2,
    RESIZE_HEIGHT: 3
});


// fireball#2856

var labelPro = _ccsg.Label.prototype;
Object.defineProperty(labelPro, 'width', {
    get: labelPro._getWidth,
    set: _ccsg.Node.prototype._setWidth
});

Object.defineProperty(labelPro, 'height', {
    get: labelPro._getHeight,
    set: _ccsg.Node.prototype._setHeight
});
