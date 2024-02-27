"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeGoogleStructValue = void 0;
var isObject = function (obj) { return typeof obj === 'object' && !Array.isArray(obj) && obj !== null; };
var FieldName;
(function (FieldName) {
    FieldName["Number"] = "numberValue";
    FieldName["String"] = "stringValue";
    FieldName["Boolean"] = "boolValue";
    FieldName["Null"] = "nullValue";
    FieldName["List"] = "listValue";
    FieldName["Struct"] = "structValue";
})(FieldName || (FieldName = {}));
;
var typeofFieldNameMap = {
    number: FieldName.Number,
    string: FieldName.String,
    boolean: FieldName.Boolean,
};
var baseFieldNameConstructorMap = (_a = {},
    _a[FieldName.Number] = Number,
    _a[FieldName.String] = String,
    _a[FieldName.Boolean] = Boolean,
    _a);
var nullFieldValue = 0;
var deserializeGoogleStructValue = function (val, sub) {
    if (sub === void 0) { sub = false; }
    if (sub === false && !isObject(val === null || val === void 0 ? void 0 : val.fields)) {
        throw new Error("Invalid Struct format. Object must include \"fields\" property");
    }
    var fieldName = Object.keys(val)[0];
    if (fieldName === FieldName.Null) {
        return null;
    }
    var baseValueTypeConstructor = baseFieldNameConstructorMap[fieldName];
    if (baseValueTypeConstructor) {
        return baseValueTypeConstructor(val[fieldName]);
    }
    if (fieldName === FieldName.List) {
        return val[fieldName].values.map(function (listValue) { return (0, exports.deserializeGoogleStructValue)(listValue, true); });
    }
    if (fieldName === FieldName.Struct) {
        return (0, exports.deserializeGoogleStructValue)(val[fieldName], true);
    }
    if (isObject(val.fields)) {
        var result_1 = {};
        Object.keys(val.fields).forEach(function (fieldName) {
            result_1[fieldName] = (0, exports.deserializeGoogleStructValue)(val.fields[fieldName], true);
        });
        return result_1;
    }
};
exports.deserializeGoogleStructValue = deserializeGoogleStructValue;
