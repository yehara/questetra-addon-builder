#!/usr/bin/env node

const fs = require('fs');
const builder = require('xmlbuilder');
const sharp = require('sharp');
const dateFormat = require('dateformat');

const ENGINE_TYPES = {
    "RHINO": 0,
    "NASHORN": 1,
    "GRAALJS_NASHORN_COMPATIBLE": 2,
    "GRAALJS": 3
};
const CONFIG_OPTIONAL_ATTRIBUTES = [
    "form-type",
    "el-enabled",
    "editable",
    "select-data-type",
    "oauth2-setting-name"
];

const basedir = process.env.PWD;
const addon = require(basedir + '/src/addon.json');

main();

async function main() {

    const xml = await buildXml();
    const targetDir = basedir + "/build";
    if(!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
    }
    const target = targetDir + "/" + addon.name + ".xml";
    fs.writeFileSync(target, xml);
    console.log("build completed successfully: " + target);

}

async function buildXml() {

    const root = builder.create('service-task-definition');

    root.ele('engine-type', ENGINE_TYPES[addon["engine-type"]]);
    
    if(addon["last-modified"]) {
        root.ele('last-modified', dateFormat(new Date(), 'yyyy-mm-dd'));
    }

    addMultilingualElement(addon, 'label', root);
    if(addon['summary']) {
        addMultilingualElement(addon, 'summary', root);
    }
    if(addon['help-page-url']) {
        addMultilingualElement(addon, 'help-page-url', root);
    }
    if (addon.configs) {
        const configs = root.ele('configs');
        addon.configs.forEach(element => {
            const config = configs.ele('config');
            config.att('name', element.name);
            config.att('required', element.required ? "true" : "false");
            CONFIG_OPTIONAL_ATTRIBUTES.forEach(key => {
                if (element[key]) {
                    config.att(key, element[key]);
                }
            });
            addMultilingualElement(element, 'label', config);
        });
    }

    // 複数の JS ファイルを、config.source の順番で連結する
    const source = addon.source || ['src/main.js'];
    const script = source.map(path => fs.readFileSync(basedir + "/" + path, 'utf8')).join("\n");
    root.ele('script').cdata("\n" + script + "\n");
    
    var iconpath = basedir + "/src/icon.png";
    if(fs.existsSync(iconpath)) {
        await loadIcon(iconpath, root)
            .catch(err => {
                console.log(err);
            });
    }

    return root.end({pretty: true});

}

function addMultilingualElement(obj, name, xmlRoot) {
    xmlRoot.ele(name, obj[name]);
    const prefix = name + "-";
    Object.keys(obj)
        .filter(key => key.startsWith(prefix))
        .forEach(key => {
            const locale = key.substring(prefix.length);
            const element = xmlRoot.ele(name, obj[key]);
            element.att('locale', locale);
        });
}

async function loadIcon(path, xmlRoot) {
    if(!fs.existsSync(path)) {
        return Promise.reject("icon file not found: " + path);
    }
    return sharp(path).resize(64, 64).toBuffer().then( data => {
        const base64 = data.toString('base64');
        xmlRoot.ele('icon', base64);
    }).catch(reason => {
        console.log(reason);
    });
}