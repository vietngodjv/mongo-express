import parser from 'mongodb-query-parser';
import { BSON, ObjectId } from 'mongodb';
import { stringify as toJavascriptString } from 'javascript-stringify';

const { EJSON } = BSON;

export const toBSON = parser;

// This function as the name suggests attempts to parse
// the free form string in to BSON, since the possibilities of failure
// are higher, this function uses a try..catch
export const toSafeBSON = function (string) {
  try {
    return toBSON(string);
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const parseObjectId = function (string) {
  if (/^[\da-f]{24}$/i.test(string)) {
    return new ObjectId(string);
  }
  return toBSON(string);
};

// Convert BSON documents to string
export const toString = function (doc) {
  return toJSString(doc, '    ');
};

export const toJsonString = function (doc) {
  return EJSON.stringify(EJSON.serialize(doc));
};

/**
 * [`Object.prototype.toString.call(value)`, `string type name`]
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString#Using_toString_to_detect_object_class
 */
const TYPE_FOR_TO_STRING = new Map([
  ['[object Array]', 'Array'],
  ['[object Object]', 'Object'],
  ['[object String]', 'String'],
  ['[object Date]', 'Date'],
  ['[object Number]', 'Number'],
  ['[object Function]', 'Function'],
  ['[object RegExp]', 'RegExp'],
  ['[object Boolean]', 'Boolean'],
  ['[object Null]', 'Null'],
  ['[object Undefined]', 'Undefined'],
]);

function detectType(value) {
  return TYPE_FOR_TO_STRING.get(Object.prototype.toString.call(value));
}

function getTypeDescriptorForValue(value) {
  const t = detectType(value);
  const _bsontype = t === 'Object' && value._bsontype;
  return {
    type: _bsontype || t,
    isBSON: !!_bsontype,
  };
}

const BSON_TO_JS_STRING = {
  Code: function (v) {
    if (v.scope) {
      return `Code('${v.code}',${JSON.stringify(v.scope)})`;
    }
    return `Code('${v.code}')`;
  },
  ObjectID: function (v) {
    return `ObjectId('${v.toString('hex')}')`;
  },
  ObjectId: function (v) {
    return `ObjectId('${v.toString('hex')}')`;
  },
  Binary: function (v) {
    const subType = v.sub_type;
    if (subType === 4 && v.buffer.length === 16) {
      let uuidHex = '';
      try {
        // Try to get the pretty hex version of the UUID
        uuidHex = v.toUUID().toString();
      } catch (ex) {
        // If uuid is not following the uuid format converting it to UUID will
        // fail, we don't want the UI to fail rendering it and instead will
        // just display "unformatted" hex value of the binary whatever it is
        uuidHex = v.toString('hex');
      }
      return `UUID('${uuidHex}')`;
    }
    // The `Binary.buffer.toString` type says it doesn't accept
    // arguments. However it does, and a test will fail without it.
    return `BinData(${subType.toString(16)}, '${v.toString('base64')}')`;
  },
  DBRef: function (v) {
    if (v.db) {
      return `DBRef('${v.namespace}', ObjectId('${v.oid.toString()}'), '${v.db}')`;
    }

    return `DBRef('${v.namespace}', ObjectId('${v.oid.toString()}'))`;
  },
  Timestamp: function (v) {
    return `Timestamp({ t: ${v.high}, i: ${v.low} })`;
  },
  Long: function (v) {
    return `NumberLong(${v.toString()})`;
  },
  Decimal128: function (v) {
    return `NumberDecimal('${v.toString()}')`;
  },
  Double: function (v) {
    return `Double('${v.toString()}')`;
  },
  Int32: function (v) {
    return `NumberInt('${v.toString()}')`;
  },
  MaxKey: function () {
    return 'MaxKey()';
  },
  MinKey: function () {
    return 'MinKey()';
  },
  Date: function (v) {
    return BSON_TO_JS_STRING.ISODate(v);
  },
  ISODate: function (v) {
    try {
      return `ISODate('${v.toISOString()}')`;
    } catch (ex) {
      return `ISODate('${v.toString()}')`;
    }
  },
  RegExp: function (v) {
    let o = '';
    let hasOptions = false;

    if (v.global) {
      hasOptions = true;
      o += 'g';
    }
    if (v.ignoreCase) {
      hasOptions = true;
      o += 'i';
    }
    if (v.multiline) {
      hasOptions = true;
      o += 'm';
    }

    return `RegExp(${JSON.stringify(v.source)}${hasOptions ? `, '${o}'` : ''})`;
  },
};

/** @public */
export const toJSString = function toJSString(obj, ind = 2) {
  return toJavascriptString(
    obj,
    function (value, indent, stringify) {
      const t = getTypeDescriptorForValue(value);
      const toJs = BSON_TO_JS_STRING[t.type];
      if (!toJs) {
        return stringify(value);
      }
      return toJs(value);
    },
    ind
  );
};

/**
 * @public
 * @deprecated
 * This function is deprecated and not recommended as it replaces
 * double spaces, newline values, and indents with only one space.
 **/
export const stringify = function stringify(obj) {
  return this.toJSString(obj, 1)
    ?.replace(/ ?\n ? ?/g, '')
    .replace(/ {2,}/g, ' ');
};
