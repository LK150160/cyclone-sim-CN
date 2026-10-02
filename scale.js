class Scale{
    constructor(/* basin, */data){
        // this.basin = basin instanceof Basin && basin;
        let opts;
        if(data && !(data instanceof LoadData)) opts = data;
        else opts = {};
        this.displayName = opts.displayName;
        this.measure = opts.measure || SCALE_MEASURE_ONE_MIN_KNOTS;   // 0 = 1-minute wind speed; 2 = pressure (10-minute wind speed not yet implemented)
        this.classifications = [];
        let cData;
        if(opts instanceof Array) cData = opts;
        else if(opts.classifications instanceof Array) cData = opts.classifications;
        if(cData){
            for(let c of cData){
                let clsn = {};
                clsn.threshold = c.threshold;
                if(clsn.threshold===undefined){
                    if(this.measure===SCALE_MEASURE_MILLIBARS) clsn.threshold = 1000;
                    else clsn.threshold = 35;
                }
                clsn.color = c.color===undefined ? 'white' : c.color;
                clsn.subtropicalColor = c.subtropicalColor;
                clsn.symbol = c.symbol===undefined ? 'C' : c.symbol;
                clsn.arms = c.arms===undefined ? 2 : c.arms;
                clsn.subtropicalSymbol = c.subtropicalSymbol;
                clsn.stormNom = c.stormNom;
                clsn.subtropicalStormNom = c.subtropicalStormNom;
                clsn.stat = c.stat;
                clsn.cName = c.cName;
                this.classifications.push(clsn);
            }
        }
        this.flavorValue = 0;
        this.flavorDisplayNames = opts.flavorDisplayNames || [];
        // numbering/naming thresholds may be overridden by DesignationSystem
        this.numberingThreshold = opts.numberingThreshold===undefined ? 0 : opts.numberingThreshold;
        this.namingThreshold = opts.namingThreshold===undefined ? 1 : opts.namingThreshold;
        if(data instanceof LoadData) this.load(data);
    }

    get(stormData){
        if(stormData instanceof StormData){
            let m;
            let c = 0;
            if(this.measure===SCALE_MEASURE_MILLIBARS || this.measure===SCALE_MEASURE_INHG){    // pressure
                m = stormData.pressure;     // millibars by default
                if(this.measure===SCALE_MEASURE_INHG) m = mbToInHg(m);
                while(c+1<this.classifications.length && m<=this.classifications[c+1].threshold) c++;
            }else{                                                                              // wind speed
                m = stormData.windSpeed;    // 1-minute knots by default
                if(this.measure===SCALE_MEASURE_TEN_MIN_KNOTS || this.measure===SCALE_MEASURE_TEN_MIN_MPH || this.measure===SCALE_MEASURE_TEN_MIN_KMH) m = oneMinToTenMin(m);    // one-minute to ten-minute wind conversion
                if(this.measure===SCALE_MEASURE_ONE_MIN_MPH || this.measure===SCALE_MEASURE_TEN_MIN_MPH) m = ktsToMph(m);   // knots-to-mph conversion
                if(this.measure===SCALE_MEASURE_ONE_MIN_KMH || this.measure===SCALE_MEASURE_TEN_MIN_KMH) m = ktsToKmh(m);   // knots-to-km/h conversion
                while(c+1<this.classifications.length && m>=this.classifications[c+1].threshold) c++;
            }
            return c;
        }
    }

    getColor(){
        let c;
        let subtropical;
        if(arguments[0] instanceof StormData){
            if(arguments[0].type===EXTROP) return COLORS.storm[EXTROP];
            if(arguments[0].type===TROPWAVE) return COLORS.storm[TROPWAVE];
            c = this.get(arguments[0]);
            subtropical = arguments[0].type===SUBTROP;
        }else{
            c = arguments[0];
            subtropical = arguments[1];
        }
        if(this.classifications.length<1) return 'white';
        while(!this.classifications[c].color && c>0) c--;
        let clsn = this.classifications[c];
        let color;
        if(subtropical && clsn.subtropicalColor) color = clsn.subtropicalColor;
        else color = clsn.color;
        if(typeof color === 'string' && color.charAt(0) === '$')
            return COLOR_SCHEMES[simSettings.colorScheme].values[color.slice(1)];
        else
            return color;
    }

    getIcon(){
        let c;
        let subtropical;
        let color;
        if(arguments[0] instanceof StormData){
            c = this.get(arguments[0]);
            subtropical = arguments[0].type===SUBTROP;
            color = this.getColor(arguments[0]);
        }else{
            c = arguments[0];
            subtropical = arguments[1];
            color = this.getColor(c,subtropical);
        }
        if(this.classifications.length<1) return {symbol: subtropical ? 'SC' : 'C', arms: 2, color: 'white'};
        while(!this.classifications[c].symbol && c>0) c--;
        let clsn = this.classifications[c];
        let symbol;
        let fetch = sym=>{
            if(sym instanceof Array) return sym[this.flavorValue];
            return sym;
        };
        if(subtropical){
            if(clsn.subtropicalSymbol) symbol = fetch(clsn.subtropicalSymbol);
            else symbol = 'S' + fetch(clsn.symbol);
        }else symbol = fetch(clsn.symbol);
        let arms = clsn.arms;
        return {symbol, arms, color};
    }

    getStormNom(){
        let c;
        let subtropical;
        if(arguments[0] instanceof StormData){
            c = this.get(arguments[0]);
            subtropical = arguments[0].type===SUBTROP;
        }else{
            c = arguments[0];
            subtropical = arguments[1];
        }
        if(this.classifications.length<1) return subtropical ? '副热带气旋' : '热带气旋';
        while(!this.classifications[c].stormNom && c>0) c--;
        let clsn = this.classifications[c];
        let fetch = n=>{
            if(n instanceof Array) return n[this.flavorValue];
            return n;
        };
        if(subtropical){
            if(clsn.subtropicalStormNom) return fetch(clsn.subtropicalStormNom);
            if(clsn.stormNom) return fetch(clsn.stormNom);
            return '副热带气旋';
        }
        if(clsn.stormNom) return fetch(clsn.stormNom);
        return '热带气旋';
    }

    getClassificationName(){
        let c;
        if(arguments[0] instanceof StormData) c = this.get(arguments[0]);
        else c = arguments[0];
        if(this.classifications.length<1) return '气旋';
        if(this.classifications[c].cName) return this.classifications[c].cName;
        return c + '';
    }

    *statDisplay(){
        for(let i=0;i<this.classifications.length;i++){
            let clsn = this.classifications[i];
            if(clsn.stat){
                if(clsn.stat instanceof Array && clsn.stat[this.flavorValue]) yield {statName: clsn.stat[this.flavorValue], cNumber: i};
                else if(typeof clsn.stat === 'string') yield {statName: clsn.stat, cNumber: i};
            }
        }
    }

    flavor(v){
        if(typeof v === 'number'){
            this.flavorValue = v;
            return this;
        }
        return this.flavorValue;
    }

    clone(){
        let newScale = new Scale();
        for(let p of [
            'displayName',
            'measure',
            'flavorValue',
            'numberingThreshold',
            'namingThreshold'
        ]) newScale[p] = this[p];
        for(let p of [
            'classifications',
            'flavorDisplayNames'
        ]) newScale[p] = JSON.parse(JSON.stringify(this[p]));
        return newScale;
    }

    save(){
        let d = {};
        for(let p of [
            'displayName',
            'measure',
            'classifications',
            'flavorValue',
            'flavorDisplayNames',
            'numberingThreshold',
            'namingThreshold'
        ]) d[p] = this[p];
        return d;
    }

    load(data){
        if(data instanceof LoadData){
            let d = data.value;
            for(let p of [
                'displayName',
                'measure',
                'classifications',
                'flavorValue',
                'flavorDisplayNames'
            ]) this[p] = d[p];
            if(d.numberingThreshold !== undefined)
                this.numberingThreshold = d.numberingThreshold;
            if(d.namingThreshold !== undefined)
                this.namingThreshold = d.namingThreshold;
            if(d.colorSchemeValue !== undefined){
                for(let c of this.classifications){
                    if(c.color instanceof Array)
                        c.color = c.color[d.colorSchemeValue];
                }
            }
        }
    }

    static convertOldValue(v){  // converts pre-v0.2 (extended) Saffir-Simpson values to Scale.extendedSaffirSimpson values
        if(v<5) return v+1;
        return v+2;
    }
}

Scale.saffirSimpson = new Scale({
    displayName: '萨菲尔-辛普森',
    flavorDisplayNames: ['飓风','台风','气旋'],
    classifications: [
        {
            threshold: 0,
            color: '$TD',
            subtropicalColor: '$SD',
            symbol: 'D',
            arms: 0,
            stormNom: '热带低压',
            subtropicalStormNom: '副热带低压',
            stat: '热带低压',
            cName: 'Depression'
        },
        {
            threshold: 34,
            color: '$TS',
            subtropicalColor: '$SS',
            symbol: 'S',
            stormNom: '热带风暴',
            subtropicalStormNom: '副热带风暴',
            stat: '命名风暴',
            cName: 'Storm'
        },
        {
            threshold: 64,
            color: '$C1',
            symbol: '1',
            stormNom: ['飓风','台风','气旋'],
            stat: ['飓风','台风','气旋'],
            cName: 'Category 1'
        },
        {
            threshold: 83,
            color: '$C2',
            symbol: '2',
            cName: 'Category 2'
        },
        {
            threshold: 96,
            color: '$C3',
            symbol: '3',
            stormNom: ['大型飓风','台风','气旋'],
            stat: ['大型飓风','Category 3+','Category 3+'],
            cName: 'Category 3'
        },
        {
            threshold: 113,
            color: '$C4',
            symbol: '4',
            cName: 'Category 4'
        },
        {
            threshold: 130,
            color: '$C4',
            symbol: '4',
            stormNom: ['大型飓风','超强台风','气旋'],
            stat: [undefined,'超强台风'],
            cName: 'Category 4 STY'
        },
        {
            threshold: 137,
            color: '$C5',
            symbol: '5',
            stat: 'Category 5s',
            cName: 'Category 5'
        }
    ]
});

Scale.extendedSaffirSimpson = new Scale({
    displayName: '扩展萨菲尔-辛普森',
    flavorDisplayNames: ['飓风','台风','气旋'],
    classifications: [
        {
            threshold: 0,
            color: '$TD',
            subtropicalColor: '$SD',
            symbol: 'D',
            arms: 0,
            stormNom: '热带低压',
            subtropicalStormNom: '副热带低压',
            stat: '热带低压',
            cName: 'Depression'
        },
        {
            threshold: 34,
            color: '$TS',
            subtropicalColor: '$SS',
            symbol: 'S',
            stormNom: '热带风暴',
            subtropicalStormNom: '副热带风暴',
            stat: '命名风暴',
            cName: 'Storm'
        },
        {
            threshold: 64,
            color: '$C1',
            symbol: '1',
            stormNom: ['飓风','台风','气旋'],
            stat: ['飓风','台风','气旋'],
            cName: 'Category 1'
        },
        {
            threshold: 83,
            color: '$C2',
            symbol: '2',
            cName: 'Category 2'
        },
        {
            threshold: 96,
            color: '$C3',
            symbol: '3',
            stormNom: ['大型飓风','台风','气旋'],
            stat: ['大型飓风','Category 3+','Category 3+'],
            cName: 'Category 3'
        },
        {
            threshold: 113,
            color: '$C4',
            symbol: '4',
            cName: 'Category 4'
        },
        {
            threshold: 130,
            color: '$C4',
            symbol: '4',
            stormNom: ['大型飓风','超强台风','气旋'],
            stat: [undefined,'超强台风'],
            cName: 'Category 4 STY'
        },
        {
            threshold: 137,
            color: '$C5',
            symbol: '5',
            stat: 'Category 5+',
            cName: 'Category 5'
        },
        {
            threshold: 165,
            color: '$C6',
            symbol: '6',
            cName: 'Category 6'
        },
        {
            threshold: 198,
            color: '$C7',
            symbol: '7',
            cName: 'Category 7'
        },
        {
            threshold: 255,
            color: '$C8',
            symbol: '8',
            stat: 'Category 8+',
            cName: 'Category 8'
        },
        {
            threshold: 318,
            color: '$C9',
            symbol: '9',
            cName: 'Category 9'
        },
        {
            threshold: 378,
            color: '$C10',
            symbol: '10',
            cName: 'Category 10'
        },
        {
            threshold: 434,
            color: '$HYC',
            symbol: 'HY',
            stormNom: ['超级气旋','超级台风','超级旋风'],
            stat: ['超级气旋','超级台风','超级旋风'],
            cName: 'Hypercane'
        }
    ]
});

Scale.australian = new Scale({
    measure: SCALE_MEASURE_TEN_MIN_KNOTS,
    displayName: '澳大利亚',
    flavorDisplayNames: ['气旋'],
    classifications: [
        {
            threshold: 0,
            color: '$TD',
            subtropicalColor: '$SD',
            symbol: 'D',
            arms: 0,
            stormNom: '热带低压',
            subtropicalStormNom: '副热带低压',
            stat: '热带低压',
            cName: 'Depression'
        },
        {
            threshold: 34,
            color: '$TS',
            subtropicalColor: '$SS',
            symbol: '1',
            stormNom: '热带气旋',
            subtropicalStormNom: '副热带气旋',
            stat: '气旋',
            cName: 'Category 1'
        },
        {
            threshold: 48,
            color: '$STS',
            subtropicalColor: '$SSS',
            symbol: '2',
            stat: 'Category 2+',
            cName: 'Category 2'
        },
        {
            threshold: 64,
            color: '$C1',
            symbol: '3',
            stat: 'Category 3+',
            cName: 'Category 3'
        },
        {
            threshold: 86,
            color: '$C3',
            symbol: '4',
            stat: 'Category 4+',
            cName: 'Category 4'
        },
        {
            threshold: 108,
            color: '$C5',
            symbol: '5',
            stat: 'Category 5s',
            cName: 'Category 5'
        }
    ]
});

Scale.JMA = new Scale({
    measure: SCALE_MEASURE_TEN_MIN_KNOTS,
    displayName: '日本气象厅',
    flavorDisplayNames: ['台风'],
    classifications: [
        {
            threshold: 0,
            color: '$TD',
            subtropicalColor: '$SD',
            symbol: 'D',
            arms: 0,
            stormNom: '热带低压',
            subtropicalStormNom: '副热带低压',
            stat: '热带低压',
            cName: 'Depression'
        },
        {
            threshold: 34,
            color: '$TS',
            subtropicalColor: '$SS',
            symbol: 'S',
            stormNom: '热带风暴',
            subtropicalStormNom: '副热带风暴',
            stat: '命名风暴',
            cName: 'Storm'
        },
        {
            threshold: 48,
            color: '$STS',
            subtropicalColor: '$SSS',
            symbol: 'STS',
            subtropicalSymbol: 'SSS',
            stormNom: '强热带风暴',
            subtropicalStormNom: '强副热带风暴',
            stat: '强',
            cName: 'Severe'
        },
        {
            threshold: 64,
            color: '$TY',
            symbol: 'TY',
            stormNom: '台风',
            stat: '台风',
            cName: 'Strong Typhoon'
        },
        {
            threshold: 85,
            color: '$VSTY',
            symbol: 'VSTY',
            stat: '非常强台风',
            cName: 'Very Strong Typhoon'
        },
        {
            threshold: 105,
            color: '$C5',
            symbol: 'VTY',
            stat: '猛烈台风',
            cName: 'Violent Typhoon'
        }
    ]
});

Scale.IMD = new Scale({
    measure: SCALE_MEASURE_TEN_MIN_KNOTS,   // technically should be 3-minute, but I didn't bother making a conversion for that
    displayName: '印度气象局',
    flavorDisplayNames: ['气旋'],
    namingThreshold: 2,
    classifications: [
        {
            threshold: 17,
            color: '$TDi',
            subtropicalColor: '$SDi',
            symbol: 'D',
            arms: 0,
            stormNom: '热带低压',
            stat: '热带低压',
            cName: 'Depression'
        },
        {
            threshold: 28,
            color: '$TD',
            subtropicalColor: '$SD',
            symbol: 'DD',
            arms: 0,
            stormNom: '深低压',
            stat: '深低压',
            cName: 'Deep Depression'
        },
        {
            threshold: 34,
            color: '$TS',
            subtropicalColor: '$SS',
            symbol: 'CS',
            subtropicalSymbol: 'SS',
            stormNom: '气旋风暴',
            stat: '气旋风暴',
            cName: 'Cyclonic Storm'
        },
        {
            threshold: 48,
            color: '$STS',
            subtropicalColor: '$SSS',
            symbol: 'SCS',
            subtropicalSymbol: 'SSS',
            stormNom: '强气旋风暴',
            stat: '强',
            cName: 'Severe Cyclonic Storm'
        },
        {
            threshold: 64,
            color: '$C1',
            symbol: 'VSCS',
            subtropicalSymbol: 'VSSS',
            stormNom: '特强气旋风暴',
            stat: '特强',
            cName: 'Very Severe Cyclonic Storm'
        },
        {
            threshold: 90,
            color: '$C3',
            symbol: 'ESCS',
            subtropicalSymbol: 'ESSS',
            stormNom: '超强气旋风暴',
            stat: '超强',
            cName: 'Extremely Severe Cyclonic Storm'
        },
        {
            threshold: 120,
            color: '$C5',
            symbol: 'SUCS',
            subtropicalSymbol: 'SUSS',
            stormNom: '超级气旋风暴',
            stat: '超级',
            cName: 'Super Cyclonic Storm'
        }
    ]
});

Scale.southwestIndianOcean = new Scale({
    measure: SCALE_MEASURE_TEN_MIN_KNOTS,
    displayName: '西南印度洋',
    flavorDisplayNames: ['气旋'],
    namingThreshold: 2,
    classifications: [
        {
            threshold: 0,
            color: '$TDi',
            subtropicalColor: '$SDi',
            symbol: 'Di',
            arms: 0,
            stormNom: '热带扰动',
            subtropicalStormNom: '副热带扰动',
            stat: '扰动',
            cName: 'Disturbance'
        },
        {
            threshold: 28,
            color: '$TD',
            subtropicalColor: '$SD',
            symbol: 'D',
            arms: 0,
            stormNom: '热带低压',
            stat: '热带低压',
            cName: 'Depression'
        },
        {
            threshold: 34,
            color: '$TS',
            subtropicalColor: '$SS',
            symbol: 'MTS',
            subtropicalSymbol: 'MSS',
            stormNom: '中等热带风暴',
            subtropicalStormNom: '中等副热带风暴',
            stat: '命名风暴',
            cName: 'Moderate Tropical Storm'
        },
        {
            threshold: 48,
            color: '$STS',
            subtropicalColor: '$SSS',
            symbol: 'STS',
            subtropicalSymbol: 'SSS',
            stormNom: '强热带风暴',
            subtropicalStormNom: '强副热带风暴',
            stat: '强',
            cName: 'Severe Tropical Storm'
        },
        {
            threshold: 64,
            color: '$C1',
            symbol: 'TC',
            subtropicalSymbol: 'SC',
            stormNom: '热带气旋',
            subtropicalStormNom: '副热带气旋',
            stat: '气旋',
            cName: 'Tropical Cyclone'
        },
        {
            threshold: 90,
            color: '$C3',
            symbol: 'ITC',
            subtropicalSymbol: 'ISC',
            stormNom: '强热带气旋',
            subtropicalStormNom: '强副热带气旋',
            stat: '强',
            cName: 'Intense Tropical Cyclone'
        },
        {
            threshold: 115,
            color: '$C5',
            symbol: 'VITC',
            subtropicalSymbol: 'VISC',
            stormNom: '特强热带气旋',
            subtropicalStormNom: '特强副热带气旋',
            stat: '特强',
            cName: 'Very Intense Tropical Cyclone'
        }
    ]
});

Scale.presetScales = [
    Scale.saffirSimpson,
    Scale.extendedSaffirSimpson,
    Scale.australian,
    Scale.JMA,
    Scale.IMD,
    Scale.southwestIndianOcean
];

// -- Color Schemes -- //

const COLOR_SCHEMES = [
    {
        name: '经典',
        values: {
            'TDi': 'rgb(75,75,245)',
            'SDi': 'rgb(95,95,235)',
            'TD': 'rgb(20,20,230)',
            'SD': 'rgb(60,60,220)',
            'TS': 'rgb(20,230,20)',
            'SS': 'rgb(60,220,60)',
            'STS': 'rgb(180,230,20)',
            'SSS': 'rgb(180,220,85)',
            'TY': 'rgb(230,230,20)',
            'VSTY': 'rgb(240,20,20)',
            'C1': 'rgb(230,230,20)',
            'C2': 'rgb(240,170,20)',
            'C3': 'rgb(240,20,20)',
            'C4': 'rgb(250,40,250)',
            'C5': 'rgb(250,140,250)',
            'C6': 'rgb(250,200,250)',
            'C7': 'rgb(240,90,90)',
            'C8': 'rgb(190,60,60)',
            'C9': 'rgb(130,10,10)',
            'C10': 'rgb(120,10,120)',
            'HYC': 'rgb(20,0,140)'
        }
    },
    {
        name: '维基',
        values: {
            'TDi': '#1591DE',
            'SDi': '#1591DE',
            'TD': '#6EC1EA',
            'SD': '#6EC1EA',
            'TS': '#4DFFFF',
            'SS': '#4DFFFF',
            'STS': '#C0FFC0',
            'SSS': '#C0FFC0',
            'TY': '#FFD98C',
            'VSTY': '#FF738A',
            'C1': '#FFFFD9',
            'C2': '#FFD98C',
            'C3': '#FF9E59',
            'C4': '#FF738A',
            'C5': '#A188FC',
            'C6': '#A188FC',
            'C7': '#A188FC',
            'C8': '#A188FC',
            'C9': '#A188FC',
            'C10': '#A188FC',
            'HYC': '#A188FC'
        }
    },
    {
        name: '维基（2023 年前/HHW）',
        values: {
            'TDi': '#80ccff',
            'SDi': '#80ccff',
            'TD': '#5ebaff',
            'SD': '#5ebaff',
            'TS': '#00faf4',
            'SS': '#00faf4',
            'STS': '#ccffff',
            'SSS': '#ccffff',
            'TY': '#fdaf9a',
            'VSTY': '#fe887d',
            'C1': '#ffffcc',
            'C2': '#ffe775',
            'C3': '#ffc140',
            'C4': '#ff8f20',
            'C5': '#ff6060',
            'C6': '#8b0000',
            'C7': '#cc0033',
            'C8': '#cc0066',
            'C9': '#9B30FF',
            'C10': '#F9A7B0',
            'HYC': '#ff99ff'
        }
    }
];