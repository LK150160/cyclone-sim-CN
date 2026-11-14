class Designation{
    constructor(value,tick,sub){
        this.num = undefined;
        if(value instanceof Array){
            let n;
            if(value.length>2){
                n = value[1];
                value[1] = zeroPad(n,2);
            }else{
                n = value[0];
                value[0] = zeroPad(n,2);
            }
            this.value = value.join('');
            if(typeof n === 'number') this.num = n;
        }else this.value = value;
        this.effectiveTicks = [tick];
        this.hideTicks = [];
        this.subBasin = sub || 0;
        if(this.value instanceof LoadData) this.load(this.value);
    }

    isName(){
        if(this.num===undefined) return true;
    }

    truncate(){
        if(this.isName()){
            return ({
                '阿尔法':'\u03B1',
                '贝塔':'\u03B2',
                '伽马':'\u03B3',
                '德尔塔':'\u03B4',
                '伊普西龙':'\u03B5',
                '泽塔':'\u03B6',
                '伊塔':'\u03B7',
                '西塔':'\u03B8',
                '约塔':'\u03B9',
                '卡帕':'\u03BA',
                '兰姆达':'\u03BB',
                '缪':'\u03BC',
                '努':'\u03BD',
                '希':'\u03BE',
                '奥密克戎':'\u03BF',
                '派':'\u03C0',
                '柔':'\u03C1',
                '西格玛':'\u03C3',
                '陶':'\u03C4',
                '宇普西龙':'\u03C5',
                '斐':'\u03C6',
                '芝':'\u03C7',
                '普赛':'\u03C8',
                '欧米伽':'\u03C9'
            })[this.value] || this.value.slice(0,1);
        }else return this.num + '';
    }
    
    activeAt(t){
        let e;
        let h;
        for(let i=0;i<this.effectiveTicks.length;i++){
            let n = this.effectiveTicks[i];
            if(t>=n && (!e || n>e)) e = n;
        }
        for(let i=0;i<this.hideTicks.length;i++){
            let n = this.hideTicks[i];
            if(t>=n && (!h || n>h)) h = n;
        }
        if(e && (!h || e>h)) return e;
        return false;
    }

    hide(t){
        if(typeof t === 'number') this.hideTicks.push(t);
    }

    show(t){
        if(typeof t === 'number') this.effectiveTicks.push(t);
    }

    save(){
        let o = {};
        for(let p of [
            'value',
            'num',
            'effectiveTicks',
            'hideTicks',
            'subBasin'
        ]) o[p] = this[p];
        return o;
    }

    load(data){
        if(data instanceof LoadData){
            let o = data.value;
            for(let p of [
                'value',
                'num',
                'subBasin'
            ]) this[p] = o[p];
            for(let p of [
                'effectiveTicks',
                'hideTicks'
            ]) if(o[p]) this[p] = o[p];
            if(o.effectiveTick) this.effectiveTicks.push(o.effectiveTick);
        }
    }
}

class DesignationSystem{
    constructor(data){
        let opts;
        if(data && !(data instanceof LoadData)) opts = data;
        else opts = {};
        this.subBasin = undefined;
        this.displayName = opts.displayName;
        // if designations should be secondary instead of primary
        this.secondary = opts.secondary;
        this.numbering = {};
        // set to false to disable numbering (prefixes and suffixes may still be used for numbered designations from a parent sub-basin)
        this.numbering.enabled = opts.numEnable===undefined ? true : opts.numEnable;
        // a prefix for numbered designations (e.g. "BOB" and "ARB")
        this.numbering.prefix = undefined;
        if(opts.prefix!==undefined) this.numbering.prefix = opts.prefix;
        else if(this.numbering.enabled) this.numbering.prefix = '';
        // a suffix for numbered designations (e.g. "L" and "E")
        this.numbering.suffix = undefined;
        if(opts.suffix!==undefined) this.numbering.suffix = opts.suffix;
        else if(this.numbering.enabled){
            if(opts.prefix!==undefined) this.numbering.suffix = '';
            else this.numbering.suffix = DEPRESSION_LETTER;
        }
        // scale category threshold for numbering a system (overrides Scale.numberingThreshold)
        this.numbering.threshold = opts.numThresh;
        // behavior for primary designations of basin-crossing systems [may need more testing]
        // 0 = always redesignate (use previous designation from this sub-basin if exists)
        // 1 = strictly redesignate (use new designation even if a previous one from this sub-basin exists)
        // 2 = redesignate regenerating systmes (keep designations of systems that retain TC status through the crossing; use previous designation if applicable)
        // 3 = strictly redesignate regenerating systems (always use new designation for regenerating systems even if previous one exists)
        // 4 = never redesignate (keep designations regardless of retaining TC status)
        this.numbering.crossingMode = opts.numCross===undefined ? DESIG_CROSSMODE_ALWAYS : opts.numCross;
        this.naming = {};
        // main name lists to be used
        this.naming.mainLists = [];
        if(opts.mainLists instanceof Array) this.naming.mainLists = opts.mainLists;
        // auxiliary lists to be used if the main list for a year is exhausted (only applicable to annual naming)
        this.naming.auxiliaryLists = [];
        if(opts.auxLists instanceof Array) this.naming.auxiliaryLists = opts.auxLists;
        // lists to be used for automatic replacement of names on other lists [To Be Implemented]
        this.naming.replacementLists = [];
        if(opts.repLists instanceof Array) this.naming.replacementLists = opts.repLists;
        // whether naming should be annual (Atl/EPac/SWIO/PAGASA) or continuous (WPac/CPac/Aus/etc.)
        this.naming.annual = opts.annual;
        // the year to anchor the cycle of annual lists to (this year will use the #0 (first) name list)
        this.naming.annualAnchorYear = opts.anchor===undefined ? 1979 : opts.anchor;
        // counter for continuous name assignment (only applicable to continuous naming)
        this.naming.continuousNameIndex = opts.indexOffset || 0;
        // scale category threshold for naming a system (overrides Scale.namingThreshold)
        this.naming.threshold = opts.nameThresh;
        // behavior for primary designations of basin-crossing systems (see above)
        this.naming.crossingMode = opts.nameCross===undefined ? DESIG_CROSSMODE_STRICT_REGEN : opts.nameCross;
        if(data instanceof LoadData) this.load(data);
    }

    setSubBasin(sb){
        if(sb instanceof SubBasin) this.subBasin = sb;
    }

    addMainLists(...lists){
        for(let l of lists){
            if(l instanceof Array){
                this.naming.mainLists.push(l);
            }
        }
        return this;
    }

    addAuxiliaryLists(...lists){
        for(let l of lists){
            if(l instanceof Array){
                this.naming.auxiliaryLists.push(l);
            }
        }
        return this;
    }

    addReplacementLists(...lists){
        for(let l of lists){
            if(l instanceof Array){
                this.naming.replacementLists.push(l);
            }
        }
        return this;
    }

    setSecondary(v){
        this.secondary = !!v;
        return this;
    }

    setCrossingModes(numCM,nameCM){
        if(numCM !== undefined) this.numbering.crossingMode = numCM;
        if(nameCM !== undefined) this.naming.crossingMode = nameCM;
        return this;
    }

    setThresholds(numThresh,nameThresh){
        if(numThresh !== undefined) this.numbering.threshold = numThresh;
        if(nameThresh !== undefined) this.naming.threshold = nameThresh;
        return this;
    }

    setContinuousNameIndex(i){
        if(i !== undefined) this.naming.continuousNameIndex = i;
        return this;
    }

    getName(tick,year,index){
        if(this.naming.mainLists.length<1) return undefined;
        if(tick===undefined && this.subBasin) tick = this.subBasin.basin.tick;
        let name;
        if(this.naming.annual){
            if(year===undefined && this.subBasin) year = this.subBasin.basin.getSeason(tick);
            let y = year - this.naming.annualAnchorYear;
            let m = this.naming.mainLists;
            let numOfLists = m.length;
            let i = (y%numOfLists+numOfLists)%numOfLists;
            let l = m[i];
            if(index===undefined) index = 0;
            if(index>=l.length){
                index -= l.length;
                m = this.naming.auxiliaryLists;
                i = 0;
                let sum = 0;
                while(i<m.length && index-sum >= m[i].length){
                    sum += m[i].length;
                    i++;
                }
                if(i>=m.length) return undefined;
                index -= sum;
                name = m[i][index];
            }else name = l[index];
        }else{
            if(index===undefined) index = 0;
            let m = this.naming.mainLists;
            let i = 0;
            let sum = 0;
            while(i<m.length && index-sum >= m[i].length){
                sum += m[i].length;
                i++;
            }
            if(i>=m.length){
                index = 0;
                i = 0;
            }else index -= sum;
            name = m[i][index];
        }
        return new Designation(name,tick,this.subBasin ? this.subBasin.id : 0);
    }

    getNewName(){
        if(this.subBasin){
            let sb = this.subBasin;
            let basin = sb.basin;
            let t = basin.tick;
            let y = basin.getSeason(t);
            let season = basin.fetchSeason(y,false,true);
            let i;
            if(this.naming.annual) i = season.stats(sb.id).designationCounters.name++;
            else{
                i = this.naming.continuousNameIndex++;
                let totalLength = 0;
                for(let l of this.naming.mainLists) totalLength += l.length;
                if(this.naming.continuousNameIndex>=totalLength) this.naming.continuousNameIndex = 0;
            }
            return this.getName(t,y,i);
        }
        return undefined;
    }

    getNum(tick,index,altPre,altSuf){
        let pre = this.numbering.prefix;
        let suf = this.numbering.suffix;
        if(altPre!==undefined) pre = altPre;
        if(altSuf!==undefined) suf = altSuf;
        let num = [pre,index,suf];
        return new Designation(num,tick,this.subBasin ? this.subBasin.id : 0);
    }

    getNewNum(altPre,altSuf){
        if(this.subBasin){
            let sb = this.subBasin;
            let basin = sb.basin;
            let t = basin.tick;
            let season = basin.fetchSeason(t,true,true);
            let i = ++season.stats(sb.id).designationCounters.number; // prefix increment because numbering starts at 01
            let numDesig = this.getNum(t,i,altPre,altSuf);
            return numDesig;
        }
        return undefined;
    }

    clone(){
        let newDS = new DesignationSystem();
        newDS.secondary = this.secondary;
        newDS.displayName = this.displayName;
        let numg = this.numbering;
        let namg = this.naming;
        let Numg = newDS.numbering;
        let Namg = newDS.naming;
        for(let p of [
            'enabled',
            'prefix',
            'suffix',
            'threshold',
            'crossingMode'
        ]) Numg[p] = numg[p];
        for(let p of [
            'annual',
            'annualAnchorYear',
            'continuousNameIndex',
            'threshold',
            'crossingMode'
        ]) Namg[p] = namg[p];
        for(let p of [
            'mainLists',
            'auxiliaryLists',
            'replacementLists'
        ]) Namg[p] = JSON.parse(JSON.stringify(namg[p]));
        return newDS;
    }

    save(){
        let d = {};
        d.secondary = this.secondary;
        d.displayName = this.displayName;
        let numg = d.numbering = {};
        let namg = d.naming = {};
        let Numg = this.numbering;
        let Namg = this.naming;
        for(let p of [
            'enabled',
            'prefix',
            'suffix',
            'threshold',
            'crossingMode'
        ]) numg[p] = Numg[p];
        for(let p of [
            'mainLists',
            'auxiliaryLists',
            'replacementLists',
            'annual',
            'annualAnchorYear',
            'continuousNameIndex',
            'threshold',
            'crossingMode'
        ]) namg[p] = Namg[p];
        return d;
    }

    load(data){
        if(data instanceof LoadData){
            let d = data.value;
            this.secondary = d.secondary;
            this.displayName = d.displayName;
            let Numg = this.numbering;
            let Namg = this.naming;
            let numg = d.numbering;
            let namg = d.naming;
            for(let p of [
                'enabled',
                'prefix',
                'suffix',
                'threshold'
            ]) Numg[p] = numg[p];
            Numg.crossingMode = numg.crossingMode || 0;
            for(let p of [
                'mainLists',
                'auxiliaryLists',
                'replacementLists',
                'annual',
                'annualAnchorYear',
                'continuousNameIndex',
                'threshold'
            ]) Namg[p] = namg[p];
            Namg.crossingMode = namg.crossingMode===undefined ? DESIG_CROSSMODE_STRICT_REGEN : namg.crossingMode;
            for(let i=Namg.auxiliaryLists.length-1;i>=0;i--){
                let a = Namg.auxiliaryLists[i];
                if(a.length===1 && a[0]==="Unnamed") Namg.auxiliaryLists.splice(i,1);
            }
            if(data.format<FORMAT_WITH_SCALES){ // convert thresholds from pre-v0.2 values
                Numg.threshold = Scale.convertOldValue(Numg.threshold);
                Namg.threshold = Scale.convertOldValue(Namg.threshold);
            }
        }
    }

    static convertFromOldNameList(list){
        let annual = list[0] instanceof Array;
        let main = [];
        let aux = [];
        if(annual){
            for(let i=0;i<list.length-1;i++) main.push(JSON.parse(JSON.stringify(list[i])));
            let auxlist = list[list.length-1];
            if(auxlist && auxlist[0]!=="Unnamed") aux.push(JSON.parse(JSON.stringify(auxlist)));
        }else main.push(JSON.parse(JSON.stringify(list)));
        return new DesignationSystem({
            mainLists: main,
            auxLists: aux,
            annual: annual
        });
    }
}

DesignationSystem.atlantic = new DesignationSystem({
    displayName: '大西洋',
    suffix: 'L',
    annual: true,
    anchor: 1979,
    mainLists: [
        ['安娜','比尔','克劳德特','丹尼','埃尔莎','弗雷德','格蕾丝','亨利','伊玛尼','朱利安','凯特','拉里','明迪','尼古拉斯','奥黛特','彼得','罗斯','萨姆','特雷莎','维克托','万达'],
        ['亚历克斯','邦妮','科林','丹妮尔','厄尔','法拉','加斯顿','赫敏','伊德里斯','朱莉娅','卡尔','莉莎','马丁','妮可','欧文','保拉','理查德','莎瑞','托比亚斯','维尔日妮','沃尔特'],
        ['阿琳','布雷特','辛迪','唐','埃米莉','富兰克林','格特','哈罗德','伊达利亚','何塞','卡蒂娅','李','玛格特','奈杰尔','奥菲莉亚','菲利普','丽娜','肖恩','塔米','文斯','惠特尼'],
        ['阿尔贝托','布里安娜','克里斯','黛比','埃内斯托','弗朗辛','戈登','霍莉','艾萨克','乔伊斯','柯克','莱斯利','米格尔','纳丁','奥斯卡','帕蒂','拉斐尔','萨拉','托尼','瓦莱丽','威廉'],
        ['安德烈亚','巴里','香塔尔','德克斯特','艾琳','费尔南','加布里埃尔','温贝托','伊梅尔达','杰里','卡伦','洛伦佐','莫莉','内斯特','奥尔加','巴勃罗','丽贝卡','塞巴斯蒂安','塔尼娅','范','温迪'],
        ['亚瑟','伯莎','克里斯托瓦尔','多莉','爱德华','费伊','贡萨洛','汉娜','伊赛亚斯','约瑟芬','凯尔','莉娅','马尔科','娜娜','奥马尔','波莱特','勒内','莎莉','特迪','维姬','威尔弗雷德']
    ],
    auxLists: [
        ["阿德里亚", "布雷伦", "卡里达德", "德肖恩", "埃默里", "福斯特", "杰玛", "希思", "艾拉", "雅各布斯", "肯齐", "卢西奥", "玛凯拉", "诺兰", "奥兰达", "帕克斯", "浪人", "索菲", "泰肖恩", "维维亚娜", "威尔"]
    ]
});

DesignationSystem.easternPacific = new DesignationSystem({
    displayName: '东太平洋',
    suffix: 'E',
    annual: true,
    anchor: 1979,
    mainLists: [
        ["安德烈斯","布兰卡","卡洛斯","多洛雷斯","恩里克","费利西亚","吉列尔莫","希尔达","伊格纳西奥","希梅娜","凯文","琳达","马蒂","诺拉","奥拉夫","帕梅拉","里克","桑德拉","特里","薇薇安","沃尔多","希娜","约克","泽尔达"],
        ["阿加莎","布拉斯","西莉亚","达比","埃斯特尔","弗兰克","乔其特","霍华德","伊薇特","哈维尔","凯","莱斯特","玛德琳","牛顿","奥琳","佩恩","罗斯林","西摩","蒂娜","维吉尔","温妮弗雷德","泽维尔","约兰达","齐克"],
        ["阿德里安","贝阿特丽斯","卡尔文","德博拉","尤金","费尔南达","格雷格","希拉里","欧文","霍瓦","肯尼思","莉迪亚","马克斯","诺尔玛","奥蒂利奥","皮拉尔","拉蒙","塞尔玛","托德","维罗妮卡","威利","希娜","约克","泽尔达"],
        ["阿莱塔","巴德","卡洛塔","丹尼尔","埃米莉亚","法比奥","吉尔玛","赫克托","伊莱亚娜","杰克","克里斯蒂","莱恩","米丽娅姆","诺曼","奥利维娅","保罗","罗莎","塞尔吉奥","塔拉","比森特","薇拉","泽维尔","约兰达","齐克"],
        ["阿尔文","芭芭拉","科斯梅","达莉拉","埃里克","弗洛西","吉尔","亨丽埃特","伊沃","朱丽叶特","基科","洛雷娜","马里奥","纳尔达","奥克塔夫","普里西拉","雷蒙德","索尼娅","蒂科","维尔玛","沃利斯","希娜","约克","泽尔达"],
        ["阿曼达","鲍里斯","克里斯蒂娜","道格拉斯","埃利达","福斯托","杰纳维耶芙","埃尔南","伊塞尔","胡利奥","卡琳娜","洛厄尔","玛丽","诺伯特","奥达莉丝","波洛","雷切尔","西蒙","特鲁迪","万斯","温妮","泽维尔","约兰达","齐克"]
    ],
    auxLists: [
        ["艾丹", "布鲁娜", "卡梅洛", "丹妮拉", "埃斯特班", "弗洛尔", "赫拉尔多", "赫达", "伊兹", "哈辛塔", "凯尼托", "月神", "玛丽娜", "南希", "奥维迪奥", "皮娅", "雷伊", "斯凯拉", "特奥", "维奥莱塔", "威尔弗雷多", "希妮娅", "亚里尔", "佐伊"]
    ]
});

DesignationSystem.centralPacific = new DesignationSystem({
    displayName: '中太平洋',
    suffix: 'C',
    mainLists: [
        ["阿科尼","埃玛","霍内","艾奥纳","凯利","拉拉","莫克","诺洛","奥拉娜","佩纳","乌拉娜","瓦莱"],
        ["阿卡","埃凯卡","赫内","约拉娜","凯奥尼","利诺","梅莱","诺娜","奥利瓦","帕马","乌帕纳","韦内"],
        ["阿利卡","埃莱","胡科","约帕","基卡","拉娜","马卡","内基","奥梅卡","佩瓦","乌娜拉","瓦利"],
        ["安娜","埃拉","哈洛拉","伊内","基洛","洛克","玛莉亚","尼亚拉","奥霍","帕利","乌莉卡","瓦拉卡"]
    ]
});

DesignationSystem.westernPacific = new DesignationSystem({
    displayName: '西太平洋',
    suffix: 'W',
    mainLists: [    // names marked with empty comments are retired and will be replaced when replacement names are announced
        ["达维","天马","鸿雁","鸳鸯","小犬","布拉万","三巴","杰拉华","蒂鲁","马利克西","格美","派比安","玛丽亚","山神","安比","悟空","云雀","珊珊","托莫","丽琵","贝碧嘉","普拉桑","苏力","西马仑","娜莱","布拉帕","百里嘉","霍阿班"],
        ["科基","银杏","青蛙","点心","鹤","帕布","蝴蝶","圣帕","孟","丹娜丝","娜莉","韦帕"/**/,"弗朗西斯科","科美"/**/,"罗莎","白鹿","杨柳","玲玲","剑鱼","农法","琵琶","塔巴","米塔"/**/,"拉加萨"/**/,"浣熊","布拉洛伊"/**/,"麦德姆"/**/,"夏浪"],
        ["娜基莉","风神","海鸥"/**/,"凤凰"/**/,"科托","诺凯恩","佩尼亚","鹦鹉","森拉克","黑格比","蔷薇","米克拉","海高斯","巴威","美莎克","海神","红霞","白海豚","鲸鱼","灿鸿","贝卢","浪卡","沙德尔","纳拉","金达莱","艾莎尼","埃唐","邦朗"],
        ["康森","杜鹃","舒力基","彩云","小熊","昌皮","烟花","钱皮卡","尼伯特","卢碧","银河","妮妲","奥迈斯","陆平","灿都","电母","蒲公英","狮子山","托凯","南川","玛露","纳托","萨尔布尔","阿穆尧","蕨菜","暹芭","埃雷","桑达"],
        ["泰拉斯","木兰","米雷","青马","蝎虎","翁芒","梅花","苗柏","南玛都","塔拉斯","霍杜","库拉","罗克","桑卡","纳沙","海棠","蜻蜓","榕树","山猫","帕卡","珊瑚","玛娃","古超","泰利","博里","卡努","兰","海星"]
    ]
});

DesignationSystem.PAGASA = new DesignationSystem({
    displayName: 'PAGASA',
    secondary: true,
    numEnable: false,
    annual: true,
    anchor: 2001,
    nameThresh: 0,
    mainLists: [
        ["奥琳","比辛","奇科","但丁","伊莱亚斯","法比安","戈里奥","华宁","伊桑","哈辛托","基科","兰妮","玛格雅万","尼拉德","奥马尔","保罗","凯丹","拉米尔","莎乐美","塔拉","乌尔巴诺","马鞭草","威尔玛","雅斯敏","索拉伊达","阿拉米德","布鲁诺","康清","多洛尔","厄尼","弗洛兰特","赫拉尔多","埃尔南","伊斯柯","杰罗姆"],
        ["艾达","巴西扬","卡洛伊","多门","埃斯特","弗朗西斯科","加多","亨利","因迪","乔西","基娅波","路易斯","梅梅","内嫩","奥贝特","皮兰多克","奎妮","罗萨尔","塞缪尔","托马斯","翁贝托","维纳斯","沃尔多","亚扬","泽尼","阿吉拉","巴格维斯","奇托","迭戈","埃琳娜","费利诺","贡丁","哈丽雅特","因当","杰莎"],
        ["阿芒","贝蒂","切登","多多","埃米尔","猎鹰","加维诺","汉娜","伊能","珍妮","卡巴扬","晨光","玛丽莲","宁法","奥尼奥克","佩拉","基尔","拉蒙","萨拉","塔玛劳","乌贡","维林","翁","约约伊","之字形","艾布","贝尔托","恰罗","达多","埃斯托伊","费利翁","格宁","赫尔曼","厄玛","海梅"],
        ["阿穆尧","布乔伊","卡琳娜","丁多","埃德林","费迪","赫内尔","海伦","伊格梅","何塞法","基杜尔","莱克普","马塞","纳诺莱","奥诺斯","普沃克","克鲁宾","罗米娜","西奥尼","托尼奥","乌庞","维姬","沃伦","约永","佐西莫","阿拉克丹","巴尔多","克拉拉","登西奥","埃斯通","费利佩","戈梅尔","赫林","伊斯梅尔","胡利奥"]
    ]
});

DesignationSystem.australianRegionBoM = new DesignationSystem({
    displayName: '澳大利亚区域（BoM）',
    suffix: 'U',
    mainLists: [
        ["阿妮卡","比利","夏洛特","达里安","埃莉","弗雷德里克","盖姆","赫尔曼","伊莎贝拉","朱利安","基马","林肯","梅林","内维尔","奥尔加","保罗","罗宾","肖恩","塔莉亚","文斯","朱"],
        ["阿基奥","比安卡","考特尼","黛安","埃罗尔","菲娜","格兰特","海莉","伊吉","珍娜","科吉","卢阿娜","米切尔","纳雷尔","欧文","佩塔","里尔登","桑德拉","蒂姆","维多利亚","赞恩"],
        ["阿莱西亚","布鲁斯","凯瑟琳","迪伦","埃德娜","弗莱彻","吉莉安","哈迪","伊万娜","杰克","凯特","拉斯洛","明珠","内森","奥里亚娜","昆西","拉克尔","斯坦","塔季扬娜","尤赖亚","伊薇特"],
        ["安东尼","布兰奇","凯莱布","达拉","厄尼","弗朗西丝","格雷格","希尔达","欧文","乔伊斯","开尔文","琳达","马尔科","诺拉","奥兰","彭妮","莱利","萨凡纳","忠","维瑞蒂","华莱士"],
        ["安珀","布莱克","克劳迪娅","德克兰","埃丝特","费迪南德","格蕾特","希思","伊莫金","约书亚","基米","卢卡斯","玛丽安","尼兰","奥黛特","帕迪","露比","斯塔福德","蒂法妮","弗农"]
    ]
});

DesignationSystem.australianRegionJakarta = new DesignationSystem({
    displayName: '澳大利亚区域（雅加达）',
    numEnable: false,
    mainLists: [
        ['安格列克','巴孔','钱皮卡','达莉亚','法兰博扬','依兰','莉莉','茉莉','红毛丹','睡莲']
    ],
    replacementLists: [
        ['葡萄','杨桃','杜古果','番石榴','龙眼','山竹','浪卡','木瓜','茄子','人心果']
    ]
});

DesignationSystem.australianRegionPortMoresby = new DesignationSystem({
    displayName: '澳大利亚区域（莫尔兹比港）',
    numEnable: false,
    mainLists: [
        ['阿卢','布里','多多','埃马乌','费雷','希布','伊拉','卡玛','洛布','梅拉']
    ],
    replacementLists: [
        ['努','奥巴哈','帕亚','拉努','萨比','陶','乌梅','瓦利','风筝','奥拉姆']
    ]
});

DesignationSystem.northIndianOcean = new DesignationSystem({
    displayName: '北印度洋',
    numEnable: false,
    mainLists: [
        ['奥尼尔','阿格尼','希巴鲁','皮亚尔','巴兹','法努斯','玛拉','穆格达'],
        ['奥格尼','阿卡什','贡努','叶敏','西德尔','纳尔吉斯','拉什米','凯穆克'],
        ['妮莎','比杰利','艾拉','费恩','沃德','莱拉','班杜','贝特'],
        ['吉里','贾尔','凯拉','塔内','穆尔詹','尼拉姆','维亚鲁','费林'],
        ['海伦','莱哈尔','马迪','纳瑙克','胡德胡德','尼洛法','阿肖巴','科门'],
        ['查帕拉','梅格','罗阿努','基安特','娜达','瓦尔达','马鲁塔','莫拉'],
        ['奥奇','萨加尔','麦库努','达耶','鲁班','蒂特利','加亚','费泰'],
        ['法尼','瓦尤','希卡','基亚尔','玛哈','布尔布尔','帕万','安攀'],
        ['尼萨加','加蒂','尼瓦尔','布雷维','陶克塔伊','亚斯','古拉布','沙欣','贾瓦德','阿萨尼','西特朗','曼杜斯','摩卡'],
        ['比帕乔伊','泰吉','哈蒙','米迪利','米昌','雷马尔','阿丝娜','达娜','冯加尔','沙克蒂','蒙塔','森亚尔','迪特瓦'],
        ['阿尔纳布','穆拉苏','阿克万','卡尼','恩加曼','赛尔','萨哈布','露露','加齐尔','吉古姆','提亚尼奥特','阿福尔','迪克萨姆'],
        ['乌帕库尔','阿格','塞潘德','奥迪','基亚蒂','纳西姆','阿芙珊','穆吉','阿西夫','加加纳','布兰','纳哈姆','西拉'],
        ['巴尔尚','维约姆','布兰','凯瑙','萨帕基','穆兹恩','玛纳希尔','苏海勒','西德拉','韦兰巴','普塔拉','库法尔','巴胡尔'],
        ['拉贾尼','贾尔','阿娜希塔','恩德里','韦敦','萨迪姆','舒贾纳','萨达夫','哈里德','加尔贾纳','艾亚拉','达曼','格维齐'],
        ['尼希特','普罗巴霍','阿扎尔','里亚乌','姆瓦胡特','迪马','帕尔瓦兹','里姆','法伊德','妮巴','萨明','迪姆','豪夫'],
        ['乌尔米','尼尔','普扬','古鲁瓦','基韦','曼朱尔','赞纳塔','拉伊汉','卡西尔','宁纳达','克赖松','加古尔','巴尔哈夫'],
        ['梅加拉','普拉班詹','阿尔沙姆','库兰吉','平库','鲁卡姆','萨萨尔','安巴尔','纳基勒','维杜利','抹茶','胡布','布罗姆'],
        ['萨米隆','古尔尼','亨加梅','库雷迪','因康','瓦塔德','巴德班','乌德','哈布','奥加','玛欣萨','德格尔','舒克拉'],
        ['普拉蒂库尔','安布德','萨瓦斯','霍兰古','林约内','阿尔贾尔兹','萨拉布','巴哈尔','巴雷克','萨利塔','帕雷瓦','阿瑟马德','法尔塔克'],
        ['萨罗博尔','贾拉迪','塔哈姆坦','通迪','基坎','拉巴布','古尔纳尔','锡夫','阿尔里姆','里维','阿苏里','布姆','达尔萨'],
        ['玛哈妮莎','织女星','图凡','法纳','包帕','拉德','瓦塞克','法纳尔','瓦比勒','鲁杜','塔拉','萨法尔','萨姆哈']
    ]
});

DesignationSystem.southWestIndianOcean = new DesignationSystem({
    displayName: '西南印度洋',
    suffix: 'R',
    annual: true,
    anchor: 2017,
    mainLists: [
        ['阿沃','布洛瑟姆','琴格','杜扎伊','埃韦采','菲蒂亚','格扎尼','奥拉西奥','因杜萨','朱卢卡','昆代','莉塞博','米歇尔','努斯拉','奥利维耶','波凯拉','昆西','雷巴奥内','萨拉马','特里斯坦','乌苏拉','紫罗兰','威尔逊','希拉','耶凯拉','扎伊娜'],
        ['阿格达','伯特兰','塞利韦','迪拉','埃米','菲克里','冈博','希斯纳','伊绍拉','杰里米','康加','卢齐','梅利娜','诺亚','奥尼亚斯','佩塔','卡马尔','丽塔','索拉尼','塔里克','乌里莉亚','武亚内','瓦格纳','苏萨','雅罗娜','萨卡里亚斯'],
        ['艾因加','巴兹尔','卡西娅','德巴','艾蒂安','法图玛','戈里','亨宁','伊泰','乔莎','卡卢卢','莱特拉马','迈佩洛','恩贾齐','奥斯卡','帕梅拉','昆廷','鲁马','索阿拉','滕巴','乌亚波','维维安','沃尔特','泽维尔','耶穆赖','扎内莱']
    ]
});

DesignationSystem.southPacific = new DesignationSystem({
    displayName: '南太平洋',
    suffix: 'F',
    mainLists: [
        ['阿鲁','比娜','卡罗尔','多维','伊娃','菲利','吉娜','黑尔','艾琳','何塞斯','基里奥','卢特','玛塔','纳特','奥赛','皮塔','雷克斯','塞鲁','谭','乌尔米尔','瓦亚努','瓦蒂','泽维尔','亚尼','齐塔'],
        ['亚瑟','贝姬','奇普','德尼亚','埃莉萨','福图','格伦','赫蒂','英尼斯','朱莉','肯','林','马丘','妮莎','奥雷亚','帕卢','勒内','萨拉','特洛伊','乌尼塔','瓦妮莎','瓦诺','伊冯娜','扎卡'],
        ['阿尔文','布内','西里尔','达尼亚尔','伊登','弗洛林','加里','黑利','伊莎','琼','科菲','路易丝','迈克','尼科','奥佩蒂','佩里','鲁本','索洛','图尼','乌鲁','维克托','瓦妮塔','耶茨','齐达内'],
        ['阿莫斯','巴特','克丽丝特尔','迪安','埃拉','费希','加思','霍拉','鸢尾','乔','卡拉','利乌阿','莫娜','尼尔','奥马','帕纳','丽塔','萨马迪约','塔西','乌耶西','维姬','瓦西','亚巴基','扎祖']
    ],
    replacementLists: [
        ['阿达马','本','克里斯蒂','达凯','埃莫西','费基','杰曼','哈特','伊利','朱尼娜','科西','莉娅','马诺阿','内塔','奥利娜','帕埃亚','罗维','塞特','特莫','乌伊拉','维尔玛','瓦内','亚瓦拉','赞娜']
    ]
});

DesignationSystem.southAtlantic = new DesignationSystem({
    displayName: '南大西洋',
    suffix: 'Q',
    mainLists: [
        ['阿拉尼','巴波','卡里','德尼','埃萨伊','瓜拉','伊巴','美洲豹','库鲁米','马尼','奥基拉','波蒂拉','拉奥尼','乌巴','雅克坎'],
        ['阿卡拉', '比瓜', '卡约巴', '恩迪', '瓜拉尼', '伊瓜苏', '雅西', '凯特', '马拉卡', '奥坎加', '波蒂', '雷里', '苏梅', '图潘', '乌帕巴', '伊巴廷加'],
        ['阿拉图', '布里', '凯萨拉', '埃萨佩', '瓜伊', '伊塔', '朱鲁', '卡图', '穆里奇', '奥里巴', '佩里', '雷亚', '桑布拉', '陶巴特', '乌鲁阿娜', '伊图']
    ]
});

// This is somewhat inaccurate but it works for now
DesignationSystem.mediterranean = new DesignationSystem({
    displayName: '地中海',
    suffix: 'M',
    annual: true,
    anchor: 2021,
    mainLists: [
        ['阿波罗', '比安卡', '齐里尔', '黛安娜', '埃内亚', '菲德拉', '戈兰', '赫拉', '伊万', '莉娜', '马尔科', '娜达', '奥莱', '潘多拉', '雷莫', '桑德拉', '特奥多尔', '乌苏拉', '维托', '佐拉'],
        ['安娜', '博格丹', '克利奥', '迪诺', '伊娃', '福博斯', '盖亚', '赫利俄斯', '伊琳娜', '利昂', '密涅瓦', '尼诺', '奥尔加', '佩塔尔', '雷亚', '西尔万', '塔莉娅', '乌戈', '维斯塔', '泽农'],
        ['亚历克西斯', '贝蒂娜', '奇罗', '多萝西娅', '埃米尔', '菲德拉', '戈里', '海尔格', '伊塔洛', '莉莉丝', '马尔科', '娜达', '奥莱', '帕尔米拉', '洛基', '雪琳', '蒂诺', '乌特', '维托', '泽娜'],
        ['阿特娜','鲍里斯','卡桑德拉','迪奥尼西奥','埃琳娜','费利克斯','加布里','汉斯','伊内斯','卢卡斯','莫伊拉','内努','奥安娜','皮诺','罗莎','西里奥','塔莉娅','乌利','维拉','佐兰'],
        ['阿莱西奥', '芭芭拉', '卡西奥', '黛博拉', '埃尔米尼奥', '弗里达', '根纳罗', '伊索塔', '利诺', '米拉', '纳诺', '奥尔加', '佩德罗', '鲁斯兰娜', '桑蒂略', '塔玛拉', '乌巴尔多', '瓦妮莎', '芝诺']
    ]
});

DesignationSystem.atlantic1950 = new DesignationSystem({
    displayName: '大西洋（1950-52）',
    suffix: 'L',
    annual: true,
    anchor: 1950,
    mainLists: [
        ['艾伯', '贝克', '查理', '狗', '伊齐', '福克斯', '乔治', '豪', '伊特姆', '吉格', '金', '洛夫', '迈克', '南', '双簧管', '彼得', '奎因', '罗杰', '苏格', '塔雷', '安可', '维克托', '威廉', '爱克斯雷', '约克', '斑马']
    ]
});

DesignationSystem.atlantic1953 = new DesignationSystem({
    displayName: '大西洋（1953-59）',
    suffix: 'L',
    annual: true,
    anchor: 1953,
    mainLists: [
        ['爱丽丝', '芭芭拉', '卡罗尔', '多莉', '埃德娜', '弗洛伦斯', '盖尔', '黑兹尔', '艾琳', '吉尔', '凯瑟琳', '露西', '梅布尔', '诺尔玛', '奥法', '帕齐', '奎因', '雷切尔', '苏西', '蒂娜', '乌娜', '维姬', '沃利斯'],
        ['爱丽丝', '芭芭拉', '卡罗尔', '多莉', '埃德娜', '弗洛伦斯', '吉尔达', '黑兹尔', '艾琳', '吉尔', '凯瑟琳', '露西', '梅布尔', '诺尔玛', '奥法', '帕齐', '奎因', '雷切尔', '苏西', '蒂娜', '乌娜', '维姬', '沃利斯'],
        ['爱丽丝', '布伦达', '康妮', '黛安', '伊迪丝', '弗洛拉', '格拉迪斯', '希尔达', '艾奥妮', '珍妮特', '凯蒂', '琳达', '玛莎', '内莉', '奥瓦', '佩吉', '奎娜', '罗莎', '斯特拉', '特鲁迪', '大熊', '维尔娜', '威尔玛', '塞妮娅', '伊冯娜', '泽尔达'],
        ['安娜', '贝齐', '卡拉', '多拉', '埃塞尔', '弗洛茜', '格蕾塔', '哈蒂', '伊内兹', '朱迪思', '基蒂', '劳拉', '莫莉', '诺娜', '奥黛特', '保拉', '奎恩比', '罗达', '萨迪', '特蕾丝', '乌尔泽尔', '维斯塔', '温妮', '希娜', '约拉', '曾达'],
        ['奥黛丽', '伯莎', '卡丽', '黛比', '埃丝特', '弗丽达', '格雷西', '汉娜', '英加', '杰西', '凯茜', '莉莎', '玛戈', '内蒂', '奥黛尔', '帕蒂', '金塔', '罗克西', '桑德拉', '西奥', '温蒂妮', '维纳斯', '温达', '艾克斯梅', '雅斯敏', '齐塔'],
        ['阿尔玛', '贝姬', '克莱奥', '黛西', '埃拉', '菲菲', '格尔达', '海伦内', '伊尔莎', '贾妮丝', '凯蒂', '莉拉', '米莉', '诺拉', '兰花', '波西娅', '奎尼', '雷娜', '雪莉', '托拉', '乌黛尔', '维尔吉', '维尔娜', '艾克斯雷', '尤里斯', '佐尔纳'],
        ['阿琳', '比尤拉', '辛迪', '德布拉', '伊迪丝', '弗洛拉', '格雷西', '汉娜', '艾琳', '朱迪思', '克里斯蒂', '洛伊丝', '玛莎', '内莉', '奥法', '彭妮', '奎拉', '雷切尔', '索菲', '塔尼娅', '乌黛尔', '维姬', '威尔玛', '艾克塞尔', '雅斯敏', '扎苏']
    ]
});

DesignationSystem.atlantic1960 = new DesignationSystem({
    displayName: '大西洋（1960-63）',
    suffix: 'L',
    annual: true,
    anchor: 1960,
    mainLists: [
        ['艾比', '布伦达', '克莱奥', '唐娜', '埃塞尔', '弗洛伦斯', '格拉迪斯', '希尔达', '伊斯贝尔', '珍妮特', '凯蒂', '莉拉', '莫莉', '妮塔', '奥黛特', '保拉', '罗克西', '斯特拉', '特鲁迪', '维斯塔', '温妮'],
        ['安娜', '贝齐', '卡拉', '黛比', '埃丝特', '弗朗西丝', '格尔达', '哈蒂', '英加', '珍妮', '卡拉', '劳里', '玛莎', '内蒂', '奥瓦', '佩吉', '罗达', '萨迪', '塔尼娅', '维尔吉', '温达'],
        ['阿尔玛', '贝姬', '西莉亚', '黛西', '埃拉', '弗洛西', '格蕾塔', '哈莉', '伊内兹', '朱迪思', '肯德拉', '洛伊丝', '玛莎', '诺琳', '奥法', '帕蒂', '雷娜', '雪莉', '托拉', '维姬', '维尔娜'],
        ['阿琳', '比尤拉', '辛迪', '德布拉', '伊迪丝', '弗洛拉', '金妮', '海伦娜', '艾琳', '贾妮丝', '克里斯蒂', '劳拉', '玛戈', '诺娜', '兰花', '波西娅', '雷切尔', '桑德拉', '特蕾丝', '维尔娜', '沃利斯']
    ]
});

DesignationSystem.atlantic1972 = new DesignationSystem({
    displayName: '大西洋（1972-78）',
    suffix: 'L',
    annual: true,
    anchor: 1972,
    mainLists: [
        ['艾格尼丝', '贝蒂', '卡丽', '道恩', '埃德娜', '费利斯', '格尔达', '哈丽雅特', '艾琳', '简', '卡拉', '露西尔', '梅', '纳丁', '奥黛特', '波莉', '丽塔', '萨拉', '蒂娜', '维尔玛', '温迪'],
        ['爱丽丝', '布伦达', '克里斯汀', '迪莉娅', '埃伦', '弗兰', '吉尔达', '海伦', '伊莫金', '乔伊', '凯特', '洛蕾塔', '玛奇', '南希', '奥娜', '帕齐', '罗斯', '莎莉', '谭', '维拉', '维尔达'],
        ['阿尔玛', '贝姬', '多莉', '伊莱恩', '菲菲', '格特鲁德', '赫斯特', '艾薇', '贾丝汀', '凯茜', '琳达', '玛莎', '内莉', '奥尔加', '珍珠', '罗克珊', '萨布丽娜', '塞尔玛', '维奥拉', '威尔玛'],
        ['艾米', '布兰奇', '卡罗琳', '多丽丝', '埃洛伊丝', '费伊', '格拉迪斯', '哈莉', '英格丽德', '朱莉娅', '基蒂', '莉莉', '梅布尔', '妮基', '蛋白石', '佩吉', '露比', '希拉', '蒂尔达', '维姬', '温妮'],
        ['安娜', '贝尔', '坎迪斯', '多蒂', '埃米', '弗朗西丝', '格洛丽亚', '霍莉', '英加', '吉尔', '凯', '莉莉亚斯', '玛丽亚', '诺拉', '奥法', '帕梅拉' ,'露丝', '雪莉', '翠茜', '维尔达', '温妮'],
        ['安妮塔', '贝布', '克拉拉', '多萝西', '伊芙琳', '弗丽达', '格蕾丝', '汉娜', '艾达', '乔迪', '克里斯蒂娜', '洛伊丝', '玛丽', '诺拉', '奥德尔', '彭妮', '拉克尔', '索菲娅', '特鲁迪', '弗吉尼亚', '薇琳'],
        ['阿梅莉亚', '贝丝', '科拉', '德布拉', '埃拉', '弗洛西', '格蕾塔', '霍普', '厄玛', '朱丽叶', '肯德拉', '路易丝', '玛莎', '诺琳', '奥拉', '保拉', '罗莎莉', '苏珊', '塔尼娅', '瓦妮莎', '万达']
    ]
});

DesignationSystem.atlantic1979 = new DesignationSystem({
    displayName: '大西洋（1979-84）',
    suffix: 'L',
    annual: true,
    anchor: 1979,
    mainLists: [
        ['安娜','鲍勃','克劳德特','戴维','埃琳娜','弗雷德里克','格洛丽亚','亨利','伊莎贝尔','胡安','凯特','拉里','明迪','尼古拉斯','奥黛特','彼得','罗斯','萨姆','特雷莎','维克托','万达'],
        ['艾伦','邦妮','查理','丹妮尔','厄尔','弗朗西丝','乔治斯','赫敏','伊万','珍妮','卡尔','莉莎','米奇','妮可','奥托','保拉','理查德','莎瑞','托马斯','维尔日妮','沃尔特'],
        ['阿琳','布雷特','辛迪','丹尼斯','埃米莉','弗洛伊德','格特','哈维','艾琳','何塞','卡特里娜','伦尼','玛丽亚','内特','奥菲莉亚','菲利普','丽塔','斯坦','塔米','文斯','威尔玛'],
        ['阿尔贝托','贝丽尔','克里斯','黛比','埃内斯托','弗洛伦斯','吉尔伯特','海伦内','艾萨克','琼','基思','莱斯利','迈克尔','纳丁','奥斯卡','帕蒂','拉斐尔','桑迪','托尼','瓦莱丽','威廉'],
        ['艾丽西亚','巴里','香塔尔','迪安','艾琳','费利克斯','加布里埃尔','雨果','鸢尾','杰里','卡伦','路易斯','玛丽莲','诺埃尔','蛋白石','巴勃罗','罗克珊','塞巴斯蒂安','塔尼娅','范','温迪'],
        ['亚瑟','伯莎','塞萨尔','黛安娜','爱德华','弗兰','古斯塔夫','霍滕斯','伊西多尔','约瑟芬','克劳斯','莉莉','马尔科','娜娜','奥马尔','帕洛玛','勒内','莎莉','特迪','维姬','威尔弗雷德']
    ],
    auxLists: [
        ['阿尔法','贝塔','伽马','德尔塔','伊普西龙','泽塔','伊塔','西塔','约塔','卡帕','兰姆达','缪','努','希','奥密克戎','派','柔','西格玛','陶','宇普西龙','斐','芝','普赛','欧米伽']
    ]
});

DesignationSystem.easternPacific1960 = new DesignationSystem({
    displayName: '东太平洋（1960-65）',
    suffix: 'E',
    mainLists: [
        ['安奈特', '邦妮', '塞莱斯特', '黛安娜', '埃斯特尔', '费尔南达', '格温', '风信子', '伊娃', '乔安妮', '凯瑟琳', '莉莎', '玛德琳', '娜奥米', '奥拉', '波琳', '丽贝卡', '西蒙娜', '塔拉', '瓦莱丽', '薇拉'],
        ['艾娃', '伯妮丝', '克劳迪娅', '多琳', '埃米莉', '弗洛伦斯', '格伦达', '黑兹尔', '伊拉', '詹妮弗', '凯瑟琳', '莉莲', '莫娜', '娜塔莉', '敖德萨', '普鲁登斯', '罗斯林', '西尔维娅', '蒂莉', '维多利亚', '沃利']
    ]
});

DesignationSystem.easternPacific1965 = new DesignationSystem({
    displayName: '东太平洋（1965-68）',
    suffix: 'E',
    annual: true,
    anchor: 1965,
    mainLists: [
        ['艾娃', '伯妮丝', '克劳迪娅', '多琳', '埃米莉', '弗洛伦斯', '格伦达', '黑兹尔', '伊拉', '詹妮弗', '凯瑟琳', '莉莲', '莫娜', '娜塔莉', '敖德萨', '普鲁登斯', '罗斯林', '西尔维娅', '蒂莉', '维多利亚', '沃利'],
        ['阿黛尔', '布兰卡', '康妮', '多洛雷斯', '艾琳', '弗朗西斯卡', '格蕾琴', '海尔格', '艾奥妮', '乔伊斯', '柯尔斯滕', '洛琳', '玛吉', '诺尔玛', '奥琳', '帕特里夏', '罗莎莉', '塞尔玛', '托尼', '薇薇安', '薇诺娜'],
        ['阿加莎', '布里奇特', '卡洛塔', '丹妮丝', '埃莉诺', '弗朗森', '乔其特', '希拉里', '伊尔莎', '朱厄尔', '卡特里娜', '百合', '莫妮卡', '纳内特', '奥利维娅', '普里西拉', '拉莫娜', '莎伦', '特里', '维罗妮卡', '温妮弗雷德'],
        ['安奈特', '邦妮', '塞莱斯特', '黛安娜', '埃斯特尔', '费尔南达', '格温', '风信子', '伊娃', '乔安妮', '凯瑟琳', '莉莎', '玛德琳', '娜奥米', '奥拉', '波琳', '丽贝卡', '西蒙娜', '塔拉', '瓦莱丽', '薇拉']
    ]
});

// original four-year rotation of male/female EPac names
DesignationSystem.easternPacific1978 = new DesignationSystem({
    displayName: '东太平洋（1978-81）',
    suffix: 'E',
    annual: true,
    anchor: 1978,
    mainLists: [
        ['阿莱塔', '巴德', '卡洛塔', '丹尼尔', '埃米莉亚', '菲科', '吉尔玛', '赫克托', '伊娃', '约翰', '克里斯蒂', '莱恩', '米丽娅姆', '诺曼', '奥利维娅', '保罗', '罗莎', '塞尔吉奥', '塔拉', '比森特', '薇拉'],
        ['安德烈斯', '布兰卡', '卡洛斯', '多洛雷斯', '恩里克', '费法', '吉列尔莫', '希尔达', '伊格纳西奥', '希梅娜', '凯文', '琳达', '马蒂', '诺拉', '奥拉夫', '波琳', '里克', '桑德拉', '特里', '薇薇安', '沃尔多'],
        ['阿加莎', '布拉斯', '西莉亚', '达比', '埃斯特尔', '弗兰克', '乔治塔', '霍华德', '伊西斯', '哈维尔', '凯', '莱斯特', '玛德琳', '牛顿', '奥琳', '佩恩', '罗斯林', '西摩', '蒂娜', '维吉尔', '温妮弗雷德'],
        ['阿德里安', '贝阿特丽斯', '卡尔文', '多拉', '尤金', '费尔南达', '格雷格', '希拉里', '欧文', '霍瓦', '克努特', '莉迪亚', '马克斯', '诺尔玛', '奥蒂斯', '皮拉尔', '拉蒙', '塞尔玛', '托德', '维罗妮卡', '威利']
    ],
    auxLists: [
        ['阿尔法', '贝塔', '伽马', '德尔塔', '伊普西龙', '泽塔', '伊塔', '西塔', '约塔', '卡帕', '兰姆达', '缪', '努', '希', '奥密克戎', '派', '柔', '西格玛', '陶', '宇普西龙', '斐', '芝', '普赛', '欧米伽']
    ]
});

// modern six-year rotation of male/female EPac names (overlaps with previous four-year rotation)
DesignationSystem.easternPacific1979 = new DesignationSystem({
    displayName: '东太平洋（1979-84）',
    suffix: 'E',
    annual: true, 
    anchor: 1979,
    mainLists: [
        ['安德烈斯', '布兰卡', '卡洛斯', '多洛雷斯', '恩里克', '费法', '吉列尔莫', '希尔达', '伊格纳西奥', '希梅娜', '凯文', '琳达', '马蒂', '诺拉', '奥拉夫', '波琳', '里克', '桑德拉', '特里', '薇薇安', '沃尔多'],
        ['阿加莎', '布拉斯', '西莉亚', '达比', '埃斯特尔', '弗兰克', '乔治塔', '霍华德', '伊西斯', '哈维尔', '凯', '莱斯特', '玛德琳', '牛顿', '奥琳', '佩恩', '罗斯林', '西摩', '蒂娜', '维吉尔', '温妮弗雷德'],
        ['阿德里安', '贝阿特丽斯', '卡尔文', '多拉', '尤金', '费尔南达', '格雷格', '希拉里', '欧文', '霍瓦', '克努特', '莉迪亚', '马克斯', '诺尔玛', '奥蒂斯', '皮拉尔', '拉蒙', '塞尔玛', '托德', '维罗妮卡', '威利'],
        ['阿莱塔', '巴德', '卡洛塔', '丹尼尔', '埃米莉亚', '法比奥', '吉尔玛', '赫克托', '伊娃', '约翰', '克里斯蒂', '莱恩', '米丽娅姆', '诺曼', '奥利维娅', '保罗', '罗莎', '塞尔吉奥', '塔拉', '比森特', '薇拉'],
        ['阿道夫', '芭芭拉', '科斯梅', '达莉拉', '埃里克', '弗洛西', '吉尔', '亨丽埃特', '伊斯梅尔', '朱丽叶特', '基科', '洛雷娜', '曼努埃尔', '纳尔达', '奥克塔夫', '普里西拉', '雷蒙德', '索尼娅', '蒂科', '维尔玛', '温妮'],
        ['阿尔玛', '鲍里斯', '克里斯蒂娜', '道格拉斯', '埃利达', '福斯托', '杰纳维耶芙', '埃尔南', '伊塞尔', '胡利奥', '肯纳', '洛厄尔', '玛丽', '诺伯特', '奥迪尔', '波洛', '雷切尔', '西蒙', '特鲁迪', '万斯', '沃利斯']
    ],
    auxLists: [
        ['阿尔法', '贝塔', '伽马', '德尔塔', '伊普西龙', '泽塔', '伊塔', '西塔', '约塔', '卡帕', '兰姆达', '缪', '努', '希', '奥密克戎', '派', '柔', '西格玛', '陶', '宇普西龙', '斐', '芝', '普赛', '欧米伽']
    ]
});

DesignationSystem.periodicTable = new DesignationSystem({
    displayName: '元素周期表',
    suffix: DEPRESSION_LETTER,
    mainLists: [
        ["Hydrogen","Helium","Lithium","Beryllium","Boron","Carbon","Nitrogen","Oxygen","Fluorine","Neon","Sodium","Magnesium","Aluminium","Silicon","Phosphorus","Sulfur","Chlorine","Argon","Potassium","Calcium","Scandium","Titanium","Vanadium","Chromium","Manganese","Iron","Cobalt","Nickel","Copper","Zinc","Gallium","Germanium","Arsenic","Selenium","Bromine","Krypton","Rubidium","Strontium","Yttrium","Zirconium","Niobium","Molybdenum","Technetium","Ruthenium","Rhodium","Palladium","Silver","Cadmium","Indium","丁","Antimony","Tellurium","Iodine","Xenon","Caesium","Barium","Lanthanum","Cerium","Praseodymium","Neodymium","Promethium","Samarium","Europium","Gadolinium","Terbium","Dysprosium","Holmium","Erbium","Thulium","Ytterbium","Lutetium","Hafnium","Tantalum","Tungsten","Rhenium","Osmium","Iridium","Platinum","Gold","Mercury","Thallium","Lead","Bismuth","Polonium","Astatine","Radon","Francium","Radium","Actinium","Thorium","Protactinium","Uranium","Neptunium","Plutonium","Americium","Curium","Berkelium","Californium","Einsteinium","Fermium","Mendelevium","Nobelium","Lawrencium","Rutherfordium","Dubnium","Seaborgium","Bohrium","Hassium","Meitnerium","Darmstadtium","Roentgenium","Copernicium","Nihonium","Flerovium","Moscovium","Livermorium","Tennessine","Oganesson"]
    ]
});

DesignationSystem.periodicTableAnnual = DesignationSystem.periodicTable.clone();
DesignationSystem.periodicTableAnnual.naming.annual = true;
DesignationSystem.periodicTableAnnual.displayName = '元素周期表（每年）';

DesignationSystem.presetDesignationSystems = [
    DesignationSystem.atlantic,
    DesignationSystem.easternPacific,
    DesignationSystem.centralPacific,
    DesignationSystem.westernPacific,
    DesignationSystem.PAGASA,
    DesignationSystem.northIndianOcean,
    DesignationSystem.australianRegionBoM,
    DesignationSystem.southPacific,
    DesignationSystem.southWestIndianOcean,
    DesignationSystem.southAtlantic,
    DesignationSystem.mediterranean,
    DesignationSystem.australianRegionJakarta,
    DesignationSystem.australianRegionPortMoresby,
    DesignationSystem.atlantic1950,
    DesignationSystem.atlantic1953,
    DesignationSystem.atlantic1960,
    DesignationSystem.atlantic1972,
    DesignationSystem.atlantic1979,
    DesignationSystem.easternPacific1960,
    DesignationSystem.easternPacific1965,
    DesignationSystem.easternPacific1978,
    DesignationSystem.easternPacific1979,
    DesignationSystem.periodicTable,
    DesignationSystem.periodicTableAnnual
];