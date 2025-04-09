importClass(org.opencv.imgproc.Imgproc);
importClass(org.opencv.core.Core);
importClass(org.opencv.core.Rect);
importClass(org.opencv.core.Mat);
importClass(org.opencv.core.Point);
importClass(org.opencv.core.Size);
importClass(org.opencv.core.CvType);
importClass(org.opencv.core.Scalar);
importClass(org.opencv.imgcodecs.Imgcodecs);
//shit
var prefixPath = ""

// 分析脚本代码的变量
let clickCount = 0;

/** 图片处理  **/
// TODO 我希望能够将matchTemplate拆分出来，显然中间的遍历scale数组的逻辑太糟糕了

function buildRegion(region, img) {
    if (region == undefined) {
        region = [];
    }
    let x = region[0] === undefined ? 0 : region[0];
    let y = region[1] === undefined ? 0 : region[1];
    let width = region[2] === undefined ? img.getWidth() - x : region[2];
    let height = region[3] === undefined ? img.getHeight() - y : region[3];
    if (x < 0 || y < 0 || x + width > img.width || y + height > img.height) {
        throw new Error(
            'out of region: region = [' + [x, y, width, height] + '], image.size = [' + [img.width, img.height] + ']'
        );
    }
    return new Rect(x, y, width, height);
}

/**
 * @param {number} threshold 图片相似度。取值范围为0~1的浮点数。默认值为0.9
 * @param {number[]} region 找图区域
 * @param {number[]} scaleFactors 大图的宽高缩放因子，默认为 [1, 0.9, 1.1, 0.8, 1.2]
 * @param {number} max 找图结果最大数量，默认为5
 * @param {boolean} grayTransform 是否进行灰度化预处理，默认为true。
 * 通常情况下将图像转换为灰度图可以简化匹配过程并提高匹配的准确性，当然，如果你的匹配任务中颜色信息对匹配结果具有重要意义，
 * 可以跳过灰度化步骤，直接在彩色图像上进行模板匹配。
 */
function MatchOptions(threshold, region, scaleFactors, max, grayTransform) {
    this.threshold = threshold;
    this.region = region;
    this.scaleFactors = scaleFactors;
    this.max = max;
    this.grayTransform = grayTransform;
}

function PointInBackground(p, bw, bh) {
    this.pointX = p.x;
    this.pointY = p.y;
    this.bgWidth = bw;
    this.bgHeight = bh;
}

const defaultMatchOptions = new MatchOptions(
    0.9,
    undefined,
    [
        [1, 1],
        [0.9, 0.9],
        [1.1, 1.1],
        [0.8, 0.8],
        [1.2, 1.2]
    ],
    5,
    true
);
// 校验参数
MatchOptions.check = function (options) {
    if (options == undefined) {
        return defaultMatchOptions;
    }
    // deep copy
    let newOptions = JSON.parse(JSON.stringify(options));
    if (newOptions.threshold == undefined) {
        newOptions.threshold = defaultMatchOptions.threshold;
    }
    if (newOptions.region && !Array.isArray(newOptions.region)) {
        throw new TypeError('region type is number[]');
    }
    if (newOptions.max == undefined) {
        newOptions.max = defaultMatchOptions.max;
    }
    if (newOptions.scaleFactors == undefined) {
        newOptions.scaleFactors = defaultMatchOptions.scaleFactors;
    } else if (!Array.isArray(newOptions.scaleFactors)) {
        throw new TypeError('scaleFactors');
    }
    for (let index = 0; index < newOptions.scaleFactors.length; index++) {
        let factor = newOptions.scaleFactors[index];
        if (Array.isArray(factor) && factor[0] > 0 && factor[1] > 0) {
            // nothing
        } else if (typeof factor === 'number') {
            newOptions.scaleFactors[index] = [factor, factor];
        } else {
            throw new TypeError('scaleFactors');
        }
    }
    if (newOptions.grayTransform === undefined) {
        newOptions.grayTransform = defaultMatchOptions.grayTransform;
    }

    return newOptions;
};

function Match(point, similarity, scaleX, scaleY) {
    this.point = point;
    this.similarity = similarity;
    this.scaleX = scaleX;
    this.scaleY = scaleY;
}

var isCacheDPI=false
var cacheDPI=undefined

function getCachedInfo(){
    return {
        isCached:isCacheDPI,
        cacheDPI:cacheDPI,
    }
}

function enableDPICache(toCache,dpi){
    if(dpi){
        cacheDPI=dpi
    }
    isCacheDPI=toCache
}

/**
 * 找图，在图中找出所有匹配的位置
 * @param {Image} img
 * @param {Image} template
 * @param {MatchOptions} options 参数见上方定义
 * @returns {Match[]}
 */
function matchTemplate(img, template, options) {
    // console.log(Imgproc.resize.toString())
    if (img == null || template == null) {
        throw new Error('ParamError img null:' + img == null + " temp == null:" + template == null);
    }
    options = MatchOptions.check(options);
    // console.log('参数：', options);

    let largeMat = img.mat;
    let templateMat = template.mat;

    // console.log("temp ", templateMat," lar ",largeMat);
    let largeGrayMat;
    let templateGrayMat;
    if (options.region) {
        options.region = buildRegion(options.region, img);
        largeMat = new Mat(largeMat, options.region);
    }
    // 灰度处理
    if (options.grayTransform) {
        largeGrayMat = new Mat();
        Imgproc.cvtColor(largeMat, largeGrayMat, Imgproc.COLOR_BGR2GRAY);
        templateGrayMat = new Mat();
        Imgproc.cvtColor(templateMat, templateGrayMat, Imgproc.COLOR_BGR2GRAY);
    }

    // console.log("tempG ", templateGrayMat,"larG ",largeGrayMat);
    // =================================================
    let finalMatches = [];
    // if(isCacheDPI)
    for (let factor of options.scaleFactors) {
        let [fx, fy] = factor;
        let resizedTemplate = new Mat();
        // console.log("templateGrayMat || templateMat ",templateGrayMat || templateMat);

        Imgproc.resize(templateGrayMat || templateMat, resizedTemplate, new Size(), fx, fy, Imgproc.INTER_LINEAR);
        // 执行模板匹配，标准化相关性系数匹配法
        let matchMat = new Mat();
        //
        //    console.log('新的temp 长宽 '+resizedTemplate.size().height+" "+resizedTemplate.size().width);
        //    console.log('新的imag 长宽 '+largeMat.size().height+" "+largeMat.size().width);
        // 检查 resizedTemplate 的尺寸是否超过 largeMat 的尺寸
        // 放缩因子可能会导致在蚂蚁窝找大象的问题        
        if (resizedTemplate.size().height > largeMat.size().height ||
            resizedTemplate.size().width > largeMat.size().width) {
            console.log('放缩后存在冲突');
            resizedTemplate.release();
            continue;
        }


        Imgproc.matchTemplate(largeGrayMat || largeMat, resizedTemplate, matchMat, Imgproc.TM_CCOEFF_NORMED);
        let currentMatches = _getAllMatch(matchMat, resizedTemplate, options.threshold, factor, options.region);
        console.log('缩放比：', factor, '可疑目标数：', currentMatches.length);
        if(currentMatches.length==1){ 
            cacheDPI=factor
        }
        for (let match of currentMatches) {
            if (finalMatches.length === 0) {
                finalMatches = currentMatches.slice(0, options.max);
                break;
            }
            if (!isOverlapping(finalMatches, match)) {
                finalMatches.push(match);
            }
            if (finalMatches.length >= options.max) {
                break;
            }
        }
        resizedTemplate.release();
        matchMat.release();
        if (finalMatches.length >= options.max) {
            break;
        }
    }
    largeMat !== img.mat && largeMat.release();
    largeGrayMat && largeGrayMat.release();
    templateGrayMat && templateGrayMat.release();

    return finalMatches;
}

/**
 * 找图，在图中找出所有匹配的位置
 * @param {Image} img
 * @param {Image} template
 * @param {MatchOptions} options 参数见上方定义
 * @returns {Match[]}
 */
function cachedMatchTemplate(img, template, options) {
    // console.log(Imgproc.resize.toString())
    if (img == null || template == null) {
        throw new Error('ParamError img null:' + img == null + " temp == null:" + template == null);
    }
    options = MatchOptions.check(options);
    // console.log('参数：', options);

    let largeMat = img.mat;
    let templateMat = template.mat;

    // console.log("temp ", templateMat," lar ",largeMat);
    let largeGrayMat;
    let templateGrayMat;
    if (options.region) {
        options.region = buildRegion(options.region, img);
        largeMat = new Mat(largeMat, options.region);
    }
    // 灰度处理
    if (options.grayTransform) {
        largeGrayMat = new Mat();
        Imgproc.cvtColor(largeMat, largeGrayMat, Imgproc.COLOR_BGR2GRAY);
        templateGrayMat = new Mat();
        Imgproc.cvtColor(templateMat, templateGrayMat, Imgproc.COLOR_BGR2GRAY);
    }

    // console.log("tempG ", templateGrayMat,"larG ",largeGrayMat);
    // =================================================
    let finalMatches = [];
    if(isCacheDPI&&cacheDPI!=undefined){

        let factor =cacheDPI
        let [fx, fy] = factor;
        let resizedTemplate = new Mat();
        // console.log("templateGrayMat || templateMat ",templateGrayMat || templateMat);

        Imgproc.resize(templateGrayMat || templateMat, resizedTemplate, new Size(), fx, fy, Imgproc.INTER_LINEAR);
        // 执行模板匹配，标准化相关性系数匹配法
        let matchMat = new Mat();
        //
        //    console.log('新的temp 长宽 '+resizedTemplate.size().height+" "+resizedTemplate.size().width);
        //    console.log('新的imag 长宽 '+largeMat.size().height+" "+largeMat.size().width);
        // 检查 resizedTemplate 的尺寸是否超过 largeMat 的尺寸
        // 放缩因子可能会导致在蚂蚁窝找大象的问题        
        if (resizedTemplate.size().height > largeMat.size().height ||
            resizedTemplate.size().width > largeMat.size().width) {
            console.log('放缩后存在冲突');
            resizedTemplate.release(); 
        } else{
            Imgproc.matchTemplate(largeGrayMat || largeMat, resizedTemplate, matchMat, Imgproc.TM_CCOEFF_NORMED);
            let currentMatches = _getAllMatch(matchMat, resizedTemplate, options.threshold, factor, options.region);
             console.log('缩放比：', factor, '可疑目标数：', currentMatches.length);
            for (let match of currentMatches) {
                if (finalMatches.length === 0) {
                    finalMatches = currentMatches.slice(0, options.max);
                    break;
                }
                if (!isOverlapping(finalMatches, match)) {
                    finalMatches.push(match);
                }
                if (finalMatches.length >= options.max) {
                    break;
                }
            }
            resizedTemplate.release();
            matchMat.release();  
        }
    } 

    largeMat !== img.mat && largeMat.release();
    largeGrayMat && largeGrayMat.release();
    templateGrayMat && templateGrayMat.release();

    return finalMatches;
}


function _getAllMatch(tmResult, templateMat, threshold, factor, rect) {
    let currentMatches = [];
    let mmr = Core.minMaxLoc(tmResult);

    while (mmr.maxVal >= threshold) {
        // 每次取匹配结果中的最大值和位置，从而使结果按相似度指标从高到低排序
        let pos = mmr.maxLoc; // Point
        let value = mmr.maxVal;

        let start = new Point(Math.max(0, pos.x - templateMat.width() / 2), Math.max(0, pos.y - templateMat.height() / 2));
        let end = new Point(
            Math.min(tmResult.width() - 1, pos.x + templateMat.width() / 2),
            Math.min(tmResult.height() - 1, pos.y + templateMat.height() / 2)
        );
        // 屏蔽已匹配到的区域
        Imgproc.rectangle(tmResult, start, end, new Scalar(0), -1);
        mmr = Core.minMaxLoc(tmResult);

        if (rect) {
            pos.x += rect.x;
            pos.y += rect.y;
            start.x += rect.x;
            start.y += rect.y;
            end.x += rect.x;
            end.y += rect.y;
        }
        let match = new Match(pos, value, factor[0], factor[1]);
        // 保存匹配点的大致范围，用于后续去重。设置enumerable为false相当于声明其为私有属性
        Object.defineProperty(match, 'matchAroundRect', { value: new Rect(start, end), writable: true, enumerable: false });
        currentMatches.push(match);
    }

    return currentMatches;
}

/**
 * 判断新检测到的点位是否与之前的某个点位重合。
 * @param {Match[]} matches
 * @param {Match} newMatch
 * @returns {boolean}
 */
function isOverlapping(matches, newMatch) {
    for (let existingMatch of matches) {
        // 也可判断两点间的距离，但是平方、开方运算不如比较范围简单高效
        if (existingMatch.matchAroundRect.contains(newMatch.point)) {
            if (newMatch.similarity > existingMatch.similarity) {
                existingMatch.point = newMatch.point;
                existingMatch.similarity = newMatch.similarity;
                existingMatch.scaleX = newMatch.scaleX;
                existingMatch.scaleY = newMatch.scaleY;
                existingMatch.matchAroundRect = newMatch.matchAroundRect;
            }
            return true;
        }
    }
    return false;
}
/**
 * 根据搜图结果在原图上画框
 * @param {Match[]} matches
 * @param {*} srcMat
 * @param {*} templateMat
 */
function showMatchRectangle(matches, srcMat, templateMat) {
    for (let match of matches) {
        let start = match.point;
        let end = new Point(
            match.point.x + templateMat.width() * match.scaleX,
            match.point.y + templateMat.height() * match.scaleY
        );
        Imgproc.rectangle(srcMat, start, end, new Scalar(0, 0, 255), 3);
    }

    const saveName = '/sdcard/Download/temp_' + getDate() + '.jpg';
    let img2 = images.matToImage(srcMat);
    images.save(img2, saveName);
    app.viewFile(saveName);
    img2.recycle();
}

/** 单图片搜索后的处理 */
// 包括
// 1. 找到图片点击中央
// 2. 找到图片拖拽,水平或垂直
// 3. 找到图片长按
// 4. 连续时间间隔里点击相同图片，或设置重试上限
// 5. 

//这个函数如果我用captureScreen做默认函数，会不会出现延时的问题？
//毕竟截一张图的时间可比创建一个int的时间长多了

//两个库混用存在问题，一个是用opencv进行查找，一个使用autox查找
//这个时候容易出现类型转换的问题
//在使用上，我们需要的是最简单的，点位或者说坐标
function clickTargetPicCentral(tar, delay, source) {
    // console.log(formatDate(new Date()) + "  clickTargetPicCentral")

    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    //    console.log("zim"+source.width)
    var res
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x) + Number(tar.width) * Number(match.scaleX) * 0.5;
        const y = Number(match.point.y) + Number(tar.height) * Number(match.scaleY) * 0.5;
        click(x, y)
        // console.log("坐标:"+match.point.x+" "+match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        // console.log("宽:"+source.width+"高"+source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        //没找到也应该清除
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}
//锚定屏幕中点的画圈器
var radius = 200; //200
var points = 20;
var reversedGesturePoints = [];
var gesturePoints = [];

function drawCircleGen(r, p) {
    radius = r
    points = p
    reversedGesturePoints = [];
    gesturePoints = [];
    var centerX = device.width/ 2; //height
    var centerY = device.height/ 2;

    for (var i = 0; i <= points; i++) {
        var angle = (i / points) * 2 * Math.PI; // 计算角度
        var x = centerX + radius * Math.cos(angle); // 计算 x 坐标
        var y = centerY + radius * Math.sin(angle); // 计算 y 坐标
        gesturePoints.push([x, y]);
    }
    for (var i = gesturePoints.length - 1; i >= 0; i--) {
        reversedGesturePoints.push(gesturePoints[i]);
    }
    return {
        drawCircle: drawCircle
    }
}

function drawCircle(round) {// 获取屏幕的宽度和高度   
    clog(reversedGesturePoints.length)
    zutils.repeatFunction(() => {
        gesture(1000, gesturePoints);
        clog("转圈圈一次")
        // },1)
    }, round)
    clog("正转")
    zutils.repeatFunction(() => {
        gesture(1000, reversedGesturePoints);
        clog("转圈圈一次")
        // },1)
    }, round)
    clog("反转")
}

/**
 * 自定义画圈器
 * @param {*} centerX 
 * @param {*} centerY 
 * @param {*} radius 
 * @param {*} points 
 * @returns 
 */
function createCircleDrawer(centerX,centerY,radius,points){
    const drawer=()=>{

    }
    const mReversedGesturePoints = [];
    const mGesturePoints = [];
    for (var i = 0; i <= points; i++) {
        var angle = (i / points) * 2 * Math.PI; // 计算角度
        var x = centerX + radius * Math.cos(angle); // 计算 x 坐标
        var y = centerY + radius * Math.sin(angle); // 计算 y 坐标
        mGesturePoints.push([x, y]);
    }
    for (var i = mGesturePoints.length - 1; i >= 0; i--) {
        mReversedGesturePoints.push(mGesturePoints[i]);
    } 

    drawer.drawCircle=(round,interval)=>{
        if(!interval){
            interval=500
        }
        zutils.repeatFunction(() => {
            gesture(interval, mGesturePoints);
            sleep(interval)
            clog("转圈圈一次") 
        }, round)
    }

    drawer.drawCircleBackwards=(round,interval)=>{
        if(!interval){
            interval=500
        }
        zutils.repeatFunction(() => {
            gesture(interval, mReversedGesturePoints);
            sleep(interval)
            clog("转圈圈一次") 
        }, round)
    }
    return drawer
}

function findSinglePicTo(fn, tar, delay, source) {
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    //    console.log("zim"+source.width)
    clog("sou w and h " + source.getWidth() + " " + source.getHeight())
    clog("tar w and h " + tar.getWidth() + " " + tar.getHeight())
    var res
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x) + Number(tar.width) * Number(match.scaleX) * 0.5;
        const y = Number(match.point.y) + Number(tar.height) * Number(match.scaleY) * 0.5;
        fn(match.point.x, match.point.y, tar.width, tar.height)
        // console.log("坐标:"+match.point.x+" "+match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        // console.log("宽:"+source.width+"高"+source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}
function findSingleColorfulPicTo(fn, tar, delay, source) {
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    //    console.log("zim"+source.width)
    clog("sou w and h " + source.getWidth() + " " + source.getHeight())
    clog("tar w and h " + tar.getWidth() + " " + tar.getHeight())
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        fn(match.point.x, match.point.y, tar.width, tar.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}
function findSinglePicFromPathTo(fn, tarp, delay, source) {
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    var tar = images.read(tarp);
    clog("sou w and h " + source.getWidth() + " " + source.getHeight())
    clog("tar w and h " + tar.getWidth() + " " + tar.getHeight())
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x) + Number(tar.width) * Number(match.scaleX) * 0.5;
        const y = Number(match.point.y) + Number(tar.height) * Number(match.scaleY) * 0.5;
        fn(match.point.x, match.point.y, tar.width, tar.height)
        // console.log("坐标:"+match.point.x+" "+match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        // console.log("宽:"+source.width+"高"+source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}
function findSingleColorfulPicFromPathTo(fn, tarp, delay, source) {
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    var tar = images.read(tarp);
    clog("sou w and h " + source.getWidth() + " " + source.getHeight())
    clog("tar w and h " + tar.getWidth() + " " + tar.getHeight())
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        fn(match.point.x, match.point.y, tar.width, tar.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}

function clickTargetPicCentralFromPath(tarp, delay, source) {
    console.log(formatDate(new Date()) + "  " + tarp)
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    } 
    if (!delay) delay = 0
    var tar = images.read(tarp);
    clog("sou w and h " + source.getWidth() + " " + source.getHeight())
    clog("tar w and h " + tar.getWidth() + " " + tar.getHeight())
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x) + Number(tar.width) * Number(match.scaleX) * 0.5;
        const y = Number(match.point.y) + Number(tar.height) * Number(match.scaleY) * 0.5;
        press(x, y, 300)
        // click(x, y)
        console.log("坐标:" + match.point.x + " " + match.point.y)
        console.log("宽:" + source.width + "高" + source.height)
        console.log("点击:" + x + "__" + y)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        console.log("没有找到图片")
        sleep(delay)
        return false
    }
}




function clog(msg) {
    console.log(msg)
}
function clickColorfulTargetPicCentralFromPath(tarp, delay, source) {
    // console.log(formatDate(new Date()) + "  clickTargetPicCentral")
    clog(tarp)
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    var tar = images.read(tarp);
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x) + Number(tar.width) * Number(match.scaleX) * 0.5;
        const y = Number(match.point.y) + Number(tar.height) * Number(match.scaleY) * 0.5;
        click(x, y)
        console.log("坐标:" + match.point.x + " " + match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        // console.log("宽:"+source.width+"高"+source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        console.log("没有找到图片")
        sleep(delay)
        return false
    }
}
function clickColorfulTargetPicLeftTop(tar, delay, source) {
    console.log(formatDate(new Date()) + "  clickTargetPicCentral")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x)
        const y = Number(match.point.y)
        click(x, y)
        console.log("坐标:" + match.point.x + " " + match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        console.log("宽:" + source.width + "高" + source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}

function clickColorfulTargetPicLeftTopFromPath(tarp, delay, source) {
    console.log(formatDate(new Date()) + "  clickTargetPicCentral")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    var tar = images.read(tarp);
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
    }
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x)
        const y = Number(match.point.y)
        click(x, y)
        console.log("坐标:" + match.point.x + " " + match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        console.log("宽:" + source.width + "高" + source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}

function clickTargetPicLeftTop(tar, delay, source) {
    console.log(formatDate(new Date()) + "  clickTargetPicCentral")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x)
        const y = Number(match.point.y)
        click(x, y)
        console.log("坐标:" + match.point.x + " " + match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        console.log("宽:" + source.width + "高" + source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}

//洗衣粉广告
/**
 * 该函数在某些环境是没有作用的
 * @param {*} path 
 * @param {*} delay 
 * @returns 
 */
function clickFromPath(path, delay) {
    var current = className("android.widget.FrameLayout").findOne();
    if (!current) {
        clog("路径无效")
        if (delay) {
            sleep(delay)
        }
        return;
    }
    for (var i = 2; i < path.length; i++) {
        // clog(current)
        // clog("路径号#"+(i+1))
        if (current.childCount() <= path[i]) {
            clog("路径无效")
            if (delay) {
                sleep(delay)
            }
            return;
        }
        current = current.child(path[i]);
    }
    current.click();
    if (delay) {
        sleep(delay)
    }
}
function clickTargetPicLeftTopFromPath(tarp, delay, source) {
    console.log(formatDate(new Date()) + "  clickTargetPicCentral")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    var tar = images.read(tarp);
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {

        let match = res[0];
        const x = Number(match.point.x)
        const y = Number(match.point.y)
        click(x, y)
        // console.log("坐标:"+match.point.x+" "+match.point.y)
        // click(match.point.x + tar.width * match.scaleX * 0.5, match.point.y + tar.height * match.scaleY * 0.5)
        // console.log("宽:"+source.width+"高"+source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}


function swipeTargetPicLeft(tar, delay, dur, source) {
    console.log(formatDate(new Date()) + "swipeTargetPicLeft")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    if (!dur) {
        dur = 200
    }
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {
        let match = res[0];
        let match_x = match.point.x + tar.width * match.scaleX * 0.5
        let match_y = match.point.y + tar.height * match.scaleY * 0.5
        //        console.log("坐标:"+match.point.x+" "+match.point.y)
        swipe(match_x, match_y, match_x + tar.width * match.scaleX * 0.5, match_y, dur)
        //        console.log("宽:"+source.width+"高"+source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}


function swipeTargetPicLeftFromPath(tarp, delay, dur, source) {
    console.log(formatDate(new Date()) + "swipeTargetPicLeft")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    var tar = images.read(tarp);
    if (!dur) {
        dur = 200
    }
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {
        let match = res[0];
        let match_x = match.point.x + tar.width * match.scaleX * 0.5
        let match_y = match.point.y + tar.height * match.scaleY * 0.5
        //        console.log("坐标:"+match.point.x+" "+match.point.y)
        swipe(match_x, match_y, match_x + tar.width * match.scaleX * 0.5, match_y, dur)
        //        console.log("宽:"+source.width+"高"+source.height)
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}

//多图片处理
// 1. 多个图片匹配,如果只有一个能够点击，那似乎问题不会太大
function clickAllPicsCentral(tar, delay, picNum, intervalT, source) {
    console.log(formatDate(new Date()) + "clickAllPicsCentral")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    if (!intervalT) {
        intervalT = 20
    }
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {
        for (let match of res) {
            var x = Number(match.point.x) + Number(tar.width) * Number(match.scaleX) * 0.5;
            var y = Number(match.point.y) + Number(tar.height) * Number(match.scaleY) * 0.5;
            console.log("x,y  " + x + "=" + match.point.x + "+" + tar.width * match.scaleX * 0.5 + "   " + y + "=" + match.point.x + "+" + tar.width * match.scaleX * 0.5)

            click(x, y)
            //        console.log("宽:"+source.width+"高"+source.height)
            sleep(intervalT)
        }
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}
function clickAllPicsCentralFromPath(tarp, delay, picNum, intervalT, source) {
    console.log(formatDate(new Date()) + "clickAllPicsCentral")
    if (!source) {
        var img = captureScreen();
        images.saveImage(img, "/sdcard/1.jpg", "jpg");
        var source = images.read("/sdcard/1.jpg");
    }
    var tar = images.read(tarp);
    if (!intervalT) {
        intervalT = 20
    }
    //    console.log("zim"+source.width)
    if(isCacheDPI){
        res = cachedMatchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }else{
        res = matchTemplate(source, tar, {
            threshold: 0.85,
            region: [100, 100],
            grayTransform: true,
            // scaleFactors: [ 1.6],
            scaleFactors: [1, 0.6, 0.7, 0.75, 0.9, 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
        })
    }
    if (res.length >= 1) {
        for (let match of res) {
            var x = Number(match.point.x) + Number(tar.width) * Number(match.scaleX) * 0.5;
            var y = Number(match.point.y) + Number(tar.height) * Number(match.scaleY) * 0.5;
            console.log("x,y  " + x + "=" + match.point.x + "+" + tar.width * match.scaleX * 0.5 + "   " + y + "=" + match.point.x + "+" + tar.width * match.scaleX * 0.5)

            click(x, y)
            //        console.log("宽:"+source.width+"高"+source.height)
            sleep(intervalT)
        }
        tar.recycle()
        source.recycle()
        sleep(delay)
        return true
    } else {
        tar.recycle()
        source.recycle()
        sleep(delay)
        return false
    }
}
function repeatFunction(fn, times) {
    if (times < 0) times = 999
    if (!times) times = 1
    for (let i = 0; i < times; i++) {
        fn(); // 调用传入的函数
    }
}

function countDownRepeat(fn, exitFn, count) {
    const exit = exitFn()
    console.log(exit); // 打印当前计数值
    if (count < 0 || exit) return; // 如果 count 小于 0 或 exitFn 返回 true，结束递归
    fn(); // 执行传入的函数
    countDownRepeat(fn, exitFn, --count); // 递归调用，count 减 1
}


function screenCentralClick(delay, isLandscape) {
    clickCount++
    console.log("click screen central count" + clickCount)
    if (isLandscape && isLandscape == true) {
        click(device.height * 0.5, device.width * 0.5)
    } else {
        click(device.width * 0.5, device.height * 0.5)
    }
    sleep(delay)
}


function landScapeCentralClick(delay) {
    clickCount++
    console.log("click screen central count" + clickCount)
    click(device.height * 0.5, device.width * 0.5)
    sleep(delay)
}

function no_action(x,y,w,h){
 
}
// /**
//  * img 图片资源
//  * delay 查找图片后的延时
//  * actionDelay 操作后的延时
//  */
// class CachedBT {
//     constructor(img,prefix,delay=500,actionDelay=100) {
//       this.x = undefined;  // 坐标x
//       this.y = undefined;  // 坐标y
//       this.w = undefined;  // 坐标y
//       this.h = undefined;  // 坐标y
//       this.img =img ;  // 图片
//       this.prefix =prefix ;  // 图片
//       this.delay =delay ;  // 图片
//       this.actionDelay =actionDelay ;  // 图片
//     }
  
//     // 点击方法
//     click() {
//       if (this.x && this.y) {
//         click(this.x, this.y);
//       }
//     }
  
//     // 搜图然后初始化
//     existCheck() {
//       return follow(
//         [[this.img, this.delay]],
//         this.prefix,
//         no_action // 绑定this以确保回调中能访问实例
//       )
//     }  
//     // 搜图然后初始化
//     /**
//      * 
//      * @param {*} fn centerX, centerY, w, h 
//      * @returns 
//      */
//     existApply(fn) {
//       if(follow(
//         [[this.img, this.delay]],
//         this.prefix,
//         this.catchPoint.bind(this) // 绑定this以确保回调中能访问实例
//       )){
//         fn(this.x,this.y,this.w,this.h)
//       }else{
//         clog("没有找到图片:"+this.img)
//       }
//     }

//     locate(){
//         return follow(
//             [[this.img, this.delay]],
//             this.prefix,
//             this.catchPoint.bind(this)  // 绑定this以确保回调中能访问实例
//           )
//     }
  
//     // 是否cache
//     check() {
//       if (this.x&&this.y) {
//         return true; //找到了
//       } else {
//         return false; //没有找到
//       }
//     }
  
//     // 坐标捕获方法
//     //必须要求
//     catchPoint(x, y, w, h) {
//       this.x = x + w / 2;  // 计算中心点x
//       this.y = y + h / 2;  // 计算中心点y
//       this.w=w;
//       this.h=h;
//       clog(this);          // 日志输出当前实例
//       sleep(this.actionDelay);
//     }
// }

var mauto=false
function autoCachedBT(mAuto){
    mauto=mAuto
}
// 使用构造函数替代 class
function CachedBT(img, prefix,tag, delay, actionDelay) {
    // 默认参数处理（ES5 无默认参数语法）
    delay = typeof delay !== 'undefined' ? delay : 500;
    tag = typeof tag !== 'undefined' ? tag : "unknown";
    actionDelay = typeof actionDelay !== 'undefined' ? actionDelay : 100;
  
    // 初始化属性
    this.x = undefined;
    this.y = undefined;
    this.w = undefined;
    this.h = undefined;
    this.tag = tag;
    this.mauto = false;
    this.img = img;
    this.prefix = prefix;
    this.delay = delay;
    this.actionDelay = actionDelay;
}

// 方法定义在原型链上
CachedBT.prototype.click = function() {
    if (this.x && this.y) {
        click(this.x, this.y);
    }
};

CachedBT.prototype.existCheck = function() {
    return follow(
        [[this.img, this.delay]],
        this.prefix,
        no_action
    );
};  
CachedBT.prototype.waitMe = function(fn,interval,round) {
    if(!interval){
        interval=500
    }
    if(!fn){
        fn=no_action
    }
    if(round==undefined||round<=1){
        round=10
    }
    var count =0
    while(!this.locate(0)){ 
        count++
        clog("等待"+this.tag)
        sleep(interval)
        if(count==round){
            return false
        }
    }
    fn(this.x, this.y, this.w, this.h);
    return true
    // while(!follow(
    //     [[this.img,interval]],
    //     this.prefix,
    //     function(x,y,w,h){
    //         fn(x,y,w,h)
    //         this.x=x
    //         this.y=y
    //     }
    // )) {
    //     count++
    //     clog("等待"+this.tag)
    //     sleep(interval)
    //     if(count==round){
    //         return false
    //     }
    // }
    // return true
}; 
  
CachedBT.prototype.existApply = function(fn,onlyPeek) {
    if(onlyPeek==undefined){
        onlyPeek=true
    }
    var result = follow(
        [[this.img, this.delay]],
        this.prefix,
        this.catchPoint.bind(this) // 保持 this 指向
    );
    if (result) {
        if(mauto&&!onlyPeek){
            enableDPICache(true)
        }
        fn(this.x, this.y, this.w, this.h);
        return true
    } else {
        
        clog("没有找到图片:" + this.img); // 模板字符串改为拼接
        if(!onlyPeek){
            enableDPICache(false)
        }
        return false
    }
};
 
CachedBT.prototype.locate = function(pre) {
    if(pre==undefined) pre=500 
    return follow(
        [[this.img, this.delay,pre]],
        this.prefix,
        this.catchPoint.bind(this)
    );
};

CachedBT.prototype.check = function() {
    return !!this.x && !!this.y;
};

CachedBT.prototype.catchPoint = function(x, y, w, h) {
    if(mauto){
        enableDPICache(true)
    }else{
        enableDPICache(false)
    }
    this.x = x + w / 2;
    this.y = y + h / 2;
    this.w = w;
    this.h = h;
    clog(this);
    sleep(this.actionDelay);
};

//wait2do 
//等到某个事件出现（图片，组件），然后去做某件事情
//找到的ponit(一个)和args作为参数提供给callback
//function waitImage2Do(template,overtime,callback,...args) {
//    var itemSleep = 500
//    if(!files.exists(template)){
//        return false
//    }
//    var temp = images.read(template)
//    for (i = 0; i < 999; i++) {
//        if (i * itemSleep > overtime) {
//            return false
//        }
//        var img = captureScreen();
//        images.saveImage(img, "/sdcard/1.jpg", "jpg");
//        var bg = images.read("/sdcard/1.jpg")
//        var point = matchTemplate(bg, temp, {
//            threshold: 0.9,
//            grayTransform: false,
//            scaleFactors: [1 , 0.6 , 0.7 , 0.9 , 1.1, 0.8, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
//            max:1
//        })
//        if (point.length > 0) {
//            bg.recycle()
//            temp.recycle()
//            callback(PointInBackground(point,temp.width,temp.height),...args)
//            return true
//        }
//        bg.recycle()
//        sleep(itemSleep)
//    }
//    bg.recycle()
//    temp.recycle()
//    return false
//};

//广告处理

// 定义控件大小的合理范围（根据实际情况调整）
var minWidth = 50; // 最小宽度
var maxWidth = 150; // 最大宽度
var minHeight = 50; // 最小高度
var maxHeight = 150; // 最大高度
var screenWidth = device.width;
var screenHeight = device.height;

// 定义目标区域（屏幕中间向右的右上角四分之一）
var targetTop = 0;
var targetLeft = Math.floor(screenWidth / 2);
var targetBottom = Math.floor(screenHeight / 4);
var targetRight = screenWidth;

var adThread = null;
function startAdDetection() {
    if (adThread) {
        console.log("ad thread already start")
    } else {
        adThread = threads.start(function () {
            detectAndClickControls();
        });
        adThread.waitFor();
    }
}
// TODO 阻塞广告检测
function startBlockingAdDetection() {
    if (adThread) {
        console.log("ad thread already start")
    } else {
        adThread = threads.start(function () {
            detectAndClickControls();
        });
        adThread.waitFor();
        console.log("使用interupt")
        adThread.interrupt()
        console.log("广告监测线程是否存活" + isAdDetctionThraedAlive())
        adThread = null
    }
}
function startBlockingDurationAdDetection(duration) {
    if (adThread) {
        console.log("ad thread already start")
    } else {
        adThread = threads.start(function () {
            detectAndClickControls();
        });
        adThread.waitFor();
        sleep(duration)
        console.log("广告监测线程是否存活" + isAdDetctionThraedAlive())
        adThread = null
    }
}
// 这个方法有奇怪的报错
function startBlockingAdDetectionRound(round) {
    if (adThread) {
        console.log("ad thread already start")
    } else {
        adThread = threads.start(function () {
            detectAndClickControlsByRounds(round);
        });
        adThread.waitFor();
        console.log("before join " + formatDate())
        try {
            adThread.join()
        } catch (e) {
            console.log("too long for executing" + formatDate())
        }
        console.log("after join" + formatDate())
        adThread = null
    }
}
// 这个方法有奇怪的报错
function startBlockingAdDetectionRoundWith(round, fn) {
    if (adThread) {
        console.log("ad thread already start")
    } else {
        adThread = threads.start(function () {
            detectAndClickControlsByRoundsWith(round, fn);
        });
        adThread.waitFor();
        console.log("before join " + formatDate())
        try {
            adThread.join()
        } catch (e) {
            console.log("too long for executing" + formatDate())
        }
        console.log("after join" + formatDate())
        adThread = null
    }
}
//暂时只有这个是有效的
function startDurationAdDetection(duration) {
    if (adThread) {
        console.log("ad thread already start")
    } else {
        adThread = threads.start(function () {
            detectAndClickControls();
        });
        adThread.waitFor();

        threads.start(function () {
            sleep(duration)
            console.log("使用interupt")
            try {
                adThread.interrupt()
            } catch (e) {
                console.error("子线程发生错误: " + e);
            }

            console.log("使用interupt之后")
            console.log("广告监测线程是否存活 innner" + isAdDetctionThraedAlive())
            // adThread=null
        })
    }
}

function startAdDetectionRound(round) {
    if (adThread) {
        console.log("ad thread already start")
    } else {
        adThread = threads.start(function () {
            detectAndClickControlsByRounds(round);
        });
        adThread.waitFor();
    }
}

function stopAdDetction() {
    if (adThread) {
        adThread.interrupt()
        adThread = null
        console.log("stoped")
    } else {
        console.log("no ad thread running")
    }

}

function isAdDetctionThraedAlive() {
    return adThread.isAlive()
}

function isSizeValid(bounds) {
    var width = bounds.width();
    var height = bounds.height();
    return width >= minWidth && width <= maxWidth &&
        height >= minHeight && height <= maxHeight;
}

function isInsideTargetRegion(bounds) {
    return bounds.top >= targetTop && bounds.left >= targetLeft &&
        bounds.bottom <= targetBottom && bounds.right <= targetRight;
}

function clickCenterOfControl(control) {
    var bounds = control.bounds();
    var centerX = bounds.centerX();
    var centerY = bounds.centerY();
    click(centerX, centerY);
    console.log("点击控件的中心点: (" + centerX + ", " + centerY + ")");
}

function detectAndClickControls() {
    while (true) { // 持续检测
        try {
            // 查找所有符合条件的按钮、视图和图片视图
            var buttons = className("android.widget.Button").find();
            var views = className("android.view.View").find();
            var imageViews = className("android.widget.ImageView").find();

            // 合并三个数组
            var controls = buttons.concat(views).concat(imageViews);

            if (controls) {
                // console.log("width height:"+screenWidth+"  "+screenHeight)
                // for(var itt of controls){
                //     console.log(itt.bounds())
                // }
                for (var i = 0; i < controls.length; i++) {
                    // console.log(i+" 遍历控件");
                    var control = controls[i];
                    if (!control) {
                        //好好的控件突然没了
                        continue;
                    }
                    var bounds = control.bounds();
                    //问题就在于上一次点击会导致数组里面的组件发生变化，但似乎问题并不是很大

                    // 检查控件是否位于目标区域内
                    if (isInsideTargetRegion(bounds) && isSizeValid(bounds)) {
                        console.log("检测到目标区域内的控件: " + control.toString());

                        // 确认控件仍然存在并且可以点击
                        if (control.clickable()) {
                            // 使用控件的中心点进行点击
                            clickCenterOfControl(control);
                            sleep(1000); // 等待一段时间以确保点击操作完成
                        } else {
                            // console.log("控件不可点击");
                        }
                        // 可选：点击后继续检测或退出循环
                        // break; // 如果只需要点击一次，可以在此处中断循环
                    }
                }
            } else {
                // console.log("无控件识别到了")
            }

            // 短暂休眠以避免过度占用CPU资源
            sleep(1500);
        } catch (e) {
            console.error("子线程发生错误: " + e);
            adThread = null
            exit()
            // 可选：处理异常后可以选择退出循环或继续尝试
            // sleep(1000); // 等待一段时间后重试
        }
    }
}

function detectAndClickControlsByRounds(round) {
    if (round && round < 0) round = 5
    var rr = 0
    while (rr++ < round) { // 持续检测
        console.log("round #" + rr)
        try {
            // 查找所有符合条件的按钮、视图和图片视图
            var buttons = className("android.widget.Button").find();
            var views = className("android.view.View").find();
            var imageViews = className("android.widget.ImageView").find();

            // 合并三个数组
            var controls = buttons.concat(views).concat(imageViews);

            if (controls) {
                // console.log("width height:"+screenWidth+"  "+screenHeight)
                // for(var itt of controls){
                //     console.log(itt.bounds())
                // }
                for (var i = 0; i < controls.length; i++) {
                    // console.log(i+" 遍历控件");
                    var control = controls[i];
                    var bounds = control.bounds();

                    // 检查控件是否位于目标区域内
                    if (isInsideTargetRegion(bounds)
                        // &&isSizeValid(bounds)
                    ) {
                        // console.log(i+" 检测到目标区域内的控件: " + control.toString());

                        // 确认控件仍然存在并且可以点击
                        if (control.clickable()) {
                            // 使用控件的中心点进行点击
                            clickCenterOfControl(control);
                            sleep(1000); // 等待一段时间以确保点击操作完成
                        } else {
                            // console.log("控件不可点击");
                        }
                        // 可选：点击后继续检测或退出循环
                        // break; // 如果只需要点击一次，可以在此处中断循环
                    }
                }
            } else {
                // console.log("无控件识别到了")
            }

            // 短暂休眠以避免过度占用CPU资源
            sleep(1500);
        } catch (e) {
            console.error("子线程发生错误: " + e);
            exit()
        }
    }
    // exit() exit会报错
}

function detectAndClickControlsByRoundsWith(round, fn) {
    if (round && round < 0) round = 5
    var rr = 0
    while (rr++ < round) { // 持续检测
        console.log("round #" + rr)
        try {
            // 查找所有符合条件的按钮、视图和图片视图
            var buttons = className("android.widget.Button").find();
            var views = className("android.view.View").find();
            var imageViews = className("android.widget.ImageView").find();

            // 合并三个数组
            var controls = buttons.concat(views).concat(imageViews);

            if (controls) {
                // console.log("width height:"+screenWidth+"  "+screenHeight)
                // for(var itt of controls){
                //     console.log(itt.bounds())
                // }
                for (var i = 0; i < controls.length; i++) {
                    // console.log(i+" 遍历控件");
                    var control = controls[i];
                    var bounds = control.bounds();

                    // 检查控件是否位于目标区域内
                    if (isInsideTargetRegion(bounds)
                        // &&isSizeValid(bounds)
                    ) {
                        // console.log(i+" 检测到目标区域内的控件: " + control.toString());

                        // 确认控件仍然存在并且可以点击
                        if (control.clickable()) {
                            // 使用控件的中心点进行点击
                            clickCenterOfControl(control);
                            sleep(1000); // 等待一段时间以确保点击操作完成
                        } else {
                            // console.log("控件不可点击");
                        }
                        // 可选：点击后继续检测或退出循环
                        // break; // 如果只需要点击一次，可以在此处中断循环
                    }
                }
            } else {
                // console.log("无控件识别到了")
            }

            // console.log("start fn","fn_start")
            fn()
            // console.log("end fn","fn_end")
            // 短暂休眠以避免过度占用CPU资源
            sleep(1500);
        } catch (e) {
            console.error("子线程发生错误: " + e);
            exit()
        }
    }
    // exit() exit会报错
}




//初始化 检查分辨率，检查初始

/** 日期 */

function formatDate(now) {
    // toast(now)
    if (!now) {
        now = new Date()
    }
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var date = now.getDate();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var second = now.getSeconds();
    var res = year + "_" + month + "_" + date + "_" + hour + "_" + minute + "_" + second
    // console.log("from formatDate zutils "+res)
    return res;
}

/**
 * 方法生成器，方法可以给出随机的水平或者垂直的两点
 * @param {*} rectWidth  范围内的宽
 * @param {*} rectHeight  范围内的高
 * @param {*} distance  两点距离
 * @param {*} addX  start
 * @param {*} addY  top
 * @returns 
 */
function create2PointGenerator(rectWidth, rectHeight, distance, addX, addY) {
    if (!addX) addX = 0
    if (!addY) addY = 0
    return function generate() {
        // 确定可用方向
        const validDirections = [];
        if (rectWidth > distance) validDirections.push('horizontal');
        if (rectHeight > distance) validDirections.push('vertical');

        // 检查是否存在有效方向
        if (validDirections.length === 0) {
            throw new Error(`距离 ${distance} 超过矩形最大允许值`);
        }

        // 随机选择可用方向
        const direction = validDirections[Math.floor(Math.random() * validDirections.length)];

        let p1, p2;

        if (direction === 'horizontal') {
            // 水平方向：X坐标需要预留distance空间
            var x = Math.floor(Math.random() * (rectWidth - distance));
            var y = Math.floor(Math.random() * rectHeight);
            p1 = { x: x + addX, y: y + addY };
            p2 = { x: x + addX + distance, y: y + addY };
        } else {
            // 垂直方向：Y坐标需要预留distance空间
            var x = Math.floor(Math.random() * rectWidth);
            var y = Math.floor(Math.random() * (rectHeight - distance));
            p1 = { x: x + addX, y: y + addY };
            p2 = { x: x + addX, y: y + addY + distance };
        }

        return [p1, p2];
    };
}
//  /**
//  * 返回屏幕水平像素
//  */
// function getWidthPixels (){
//     let dm = context.getResources().getDisplayMetrics();
//     let wm = context.getSystemService(context.WINDOW_SERVICE);
//     wm.getDefaultDisplay().getRealMetrics(dm);
//     return dm.widthPixels
// }

// /**
//  * 返回屏幕纵向像素
//  */
// function getHeightPixels () {
//     let dm = context.getResources().getDisplayMetrics();
//     let wm = context.getSystemService(context.WINDOW_SERVICE);
//     wm.getDefaultDisplay().getRealMetrics(dm);
//     return dm.heightPixels
// }
// function easyRequestScreenCapture(){ 
//     const width = getWidthPixels(); // 获取当前方向下的宽度(px)
//     const height = getHeightPixels(); // 获取当前方向下的宽度(px)
//     const rotation = activity.getWindowManager().getDefaultDisplay().getRotation(); // 获取旋转角度
//     return rotation == 0 ? width < height: width > height 
// }
function s(arr, prefix) {
    arr.forEach(function (i) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        // sleep(60000)
        if (typeof i === 'string') {
            p = i;
            d = 500;
        } else if (Array.isArray(i)) {
            p = i[0];
            d = i[1] || 500;
            iv = i[2];
        } else {
            p = i.p || i.path;
            d = i.d || i.delay || 500;
            iv = i.i || i.interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
        } else if (p === "lc") {
            landScapeCentralClick(d);
        } else {
            clog("操作" + p)
            var finalPath = prefix ? prefix + p : p; // 根据getPath参数决定是否转换路径
            clickTargetPicCentralFromPath(finalPath, d);
        }
    });
}
/**
 * 根据id的点击序列
 * @param {} arr  点击序列
 */
function ids(arr) {
    arr.forEach(function (i) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        // sleep(60000)
        if (typeof i === 'string') {
            p = i;
            d = 500;
        } else if (Array.isArray(i)) {
            p = i[0];
            d = i[1] || 500;
            iv = i[2];
        } else {
            p = i.p || i.path;
            d = i.d || i.delay || 500;
            iv = i.i || i.interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
        } else if (p === "lc") {
            landScapeCentralClick(d);
        } else {
            // clog("操作 id "+p)
            var comp = id(p).findOne(1000)
            if (comp) {
                // comp.click()
                click(comp.bounds().centerX(),
                 comp.bounds().centerY()
                )
            } else {
                clog("id not foud "+p)
            }
            sleep(d)
        }
    });
}
function ts(arr) {
    arr.forEach(function (i) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        // sleep(60000)
        if (typeof i === 'string') {
            p = i;
            d = 500;
        } else if (Array.isArray(i)) {
            p = i[0];
            d = i[1] || 500;
            iv = i[2];
        } else {
            p = i.p || i.path;
            d = i.d || i.delay || 500;
            iv = i.i || i.interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
        } else if (p === "lc") {
            landScapeCentralClick(d);
        } else {
            clog("操作 text " + p)
            let comp = text(p).findOne(1000)
            if (comp) {
                // comp.click()
                click(comp.bounds().centerX(),
                  comp.bounds().centerY()
                )
            } else {
                clog("text not foud " + p)
            }
        }
        sleep(d)
    });
}
function cs(arr, prefix) {
    arr.forEach(function (i) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        // sleep(60000)
        if (typeof i === 'string') {
            p = i;
            d = 500;
        } else if (Array.isArray(i)) {
            p = i[0];
            d = i[1] || 500;
            iv = i[2];
        } else {
            p = i.p || i.path;
            d = i.d || i.delay || 500;
            iv = i.i || i.interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
        } else if (p === "lc") {
            landScapeCentralClick(d);
        } else {
            clog("操作" + p)
            let finalPath = prefix ? prefix + p : p; // 根据getPath参数决定是否转换路径
            clickColorfulTargetPicCentralFromPath(finalPath, d);
        }
    });
}
function cfs(arr, prefix, fn) {
    arr.forEach(function (i) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        // sleep(60000)
        if (typeof i === 'string') {
            p = i;
            d = 500;
        } else if (Array.isArray(i)) {
            p = i[0];
            d = i[1] || 500;
            iv = i[2];
        } else {
            p = i.p || i.path;
            d = i.d || i.delay || 500;
            iv = i.i || i.interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            // screenCentralClick(d);
            clog("有颜色操作阵列不支持点击屏幕中央")
        } else if (p === "lc") {
            clog("有颜色操作阵列不支持点击landscap屏幕中央")
            // landScapeCentralClick(d);
        } else {
            clog("操作" + p)
            var finalPath = prefix ? prefix + p : p; // 根据getPath参数决定是否转换路径
            findSingleColorfulPicFromPathTo(fn, finalPath, d)
        }
    });
}
/**
 * 有颜色操作矩阵
 * @param {操作数组} arr 
 * @param {路径前缀} prefix 
 * @param {操作函数:参数为图片的xywh} fn 
 */
function fs(arr, prefix, fn) {
    arr.forEach(function (i) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        // sleep(60000)
        if (typeof i === 'string') {
            clog("type1")
            p = i;
            d = 500;
        } else if (Array.isArray(i)) {
            clog("type2")
            p = i[0];
            d = i[1] || 500;
            iv = i[2];
        } else {
            clog("type3")
            p = i.p || i.path;
            d = i.d || i.delay || 500;
            iv = i.i || i.interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
            clog("无颜色操作阵列不支持点击屏幕中央")
        } else if (p === "lc") {
            clog("无颜色操作阵列不支持点击landscap屏幕中央")
            landScapeCentralClick(d);
        } else {
            clog("操作" + p)
            var finalPath = prefix ? prefix + p : p; // 根据getPath参数决定是否转换路径
            findSinglePicFromPathTo(fn, finalPath, d)
        }
    });
}
/**
 * 遍历输入的图片序列进行操作，如果没有找到就停止
 * @param {*} arr 
 * @param {*} prefix 
 * @param {*} fn fn(match.point.x, match.point.y, tar.width, tar.height) x,y是左上角
 */
function follow(arr, prefix, fn) {
    for (let i = 0; i < arr.length; i++) {
        current = arr[i];
        // 处理断言函数
        if (typeof current === 'function') {
            try {
                if (!current()) {
                    clog("断言函数返回false，终止流程");
                    return false;
                }
            } catch (e) {
                clog(`断言函数执行错误: ${e}`);
                return false;
            }
            continue;
        }
        
        // 参数解析（兼容ES5）
        var p, d, iv;
        if (typeof arr[i] === 'string') {
            clog("type1");
            p = arr[i];
            d = 500;
        } else if (Array.isArray(arr[i])) {
            clog("type2");
            p = arr[i][0];
            d = arr[i][1] || 500;
            iv = arr[i][2];
        } else {
            clog("type3");
            p = arr[i].p || arr[i].path;
            d = arr[i].d || arr[i].delay || 500;
            iv = arr[i].i || arr[i].interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
            clog("无颜色操作阵列不支持点击屏幕中央");
        } else if (p === "lc") {
            clog("无颜色操作阵列不支持点击landscap屏幕中央");
            landScapeCentralClick(d);
        } else {
            clog("操作" + p);
            
            var finalPath = prefix ? prefix + p : p; // 根据getPath参数决定是否转换路径
            if (!findSinglePicFromPathTo(fn, finalPath, d)) {
                sleep(d)
                return false
            }
            sleep(d)
        }
    }
    return true
}
/**
 * 遍历输入的图片序列进行操作，如果没有找到就停止
 * @param {*} arr  
 */
function tfollow(arr) {
    for (let i = 0; i < arr.length; i++) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        if (typeof arr[i] === 'string') {
            clog("type1");
            p = arr[i];
            d = 500;
        } else if (Array.isArray(arr[i])) {
            clog("type2");
            p = arr[i][0];
            d = arr[i][1] || 500;
            iv = arr[i][2];
        } else {
            clog("type3");
            p = arr[i].p || arr[i].path;
            d = arr[i].d || arr[i].delay || 500;
            iv = arr[i].i || arr[i].interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
            clog("无颜色操作阵列不支持点击屏幕中央");
        } else if (p === "lc") {
            clog("无颜色操作阵列不支持点击landscap屏幕中央");
            landScapeCentralClick(d);
        } else {
            // let comp = text(p).findOne(1000)
            
            let escapedP = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 转义特殊字符
            let regex = new RegExp(`.*${escapedP}$`); // 动态构建正则表达式
            let comp = textMatches(regex).findOne(1000);
            // let comp = text(p).findOne(1000)
            if (comp) {
                // comp.click()
                click(Math.abs(comp.bounds().centerX()) ,
                Math.abs(comp.bounds().centerY())
                )
                sleep(d)
            } else {
                clog("text not foud " + p)
                sleep(d)
                return false
            } 
        }
    }
    return true
}
/**
 * 遍历输入的图片序列进行操作，如果没有找到就停止
 * @param {*} arr 
 * @param {*} prefix 
 * @param {*} fn fn(match.point.x, match.point.y, tar.width, tar.height) x,y是左上角
 */
function idfollow(arr) {
    for (let i = 0; i < arr.length; i++) {
        // 参数解析（兼容ES5）
        var p, d, iv;
        if (typeof arr[i] === 'string') {
            clog("type1");
            p = arr[i];
            d = 500;
        } else if (Array.isArray(arr[i])) {
            clog("type2");
            p = arr[i][0];
            d = arr[i][1] || 500;
            iv = arr[i][2];
        } else {
            clog("type3");
            p = arr[i].p || arr[i].path;
            d = arr[i].d || arr[i].delay || 500;
            iv = arr[i].i || arr[i].interval;
        }

        // 前置等待
        if (iv) sleep(iv);

        // 执行操作
        if (p === "c") {
            screenCentralClick(d);
            clog("无颜色操作阵列不支持点击屏幕中央");
        } else if (p === "lc") {
            clog("无颜色操作阵列不支持点击landscap屏幕中央");
            landScapeCentralClick(d);
        } else {
            
            let escapedP = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 转义特殊字符
            let regex = new RegExp(`.*${escapedP}$`); // 动态构建正则表达式
            let comp = idMatches(regex).findOne(1000);
            // let comp = id(p).findOne(1000)
            if (comp) {
                // comp.click()
                click(Math.abs(comp.bounds().centerX()) ,
                  Math.abs(comp.bounds().centerY())
                )
                sleep(d)
            } else {
                clog("id not foud " + p)
                sleep(d)
                return false
             } 
        }
    }
    return true
}
/* 使用示例 */
// s([
//     "play.png",           // 纯路径（使用默认5秒超时）
//     ["bag_1.png", 3e3],  // 数组简写（3秒超时）
//     ["reveal.png", , 1e3], // 空位占位符（默认超时+1秒间隔）
//     {p: "exe_1.png", i:500} // 对象简写
// ]);

function createAdDetector(whiteListPath) {
    // 私有变量
    let regex = null;

    // 初始化逻辑
    (function init() {
        try {
            clog("soso")
            clog(whiteListPath)
            const whiteList = JSON.parse(files.read(whiteListPath));
            clog(whiteListPath)
            // 合并所有匹配模式
            // const patterns = [
            //     ...whiteList.globalPatterns,
            //     ...collectPackageSpecific(whiteList.packageSpecific)
            // ].map(escapeRegExp);

            //上述不支持
            const patterns = whiteList.globalPatterns.concat(collectPackageSpecific(whiteList.packageSpecific)).map(escapeRegExp);



            // 构建正则表达式
            regex = new RegExp(
                // `(^|.*:id/)(${patterns.join('|')})$`, 
                // 'i'

                `(?:^|.*:id\/)(${patterns.join('|')})$`
            );
        } catch(e) {
            console.error("广告检测器初始化失败:", e);
            regex = /$^/; // 生成不可能匹配的正则
        }
    })();

    // 公共方法
    return {
        isAdNow: function() {
            var comp=idMatches(regex).findOne(500)
            clog(regex)
            if(comp){
                clog(comp)
            }else{
                clog("not found")
            }
            return !!idMatches(regex).findOne(500);
        }
    };

    // 私有工具函数
    function collectPackageSpecific(packageMap) {
        //版本不支持
        // return Object.values(packageMap).flat();
        
        return Object.values(packageMap || {}).reduce((acc, arr) => acc.concat(arr || []), []);
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

function ddclickCenter(centerX,centerY,w,h){
    click(centerX,centerY)
    sleep(100) 
}
/**
 * 增强版统一操作函数
 * @param {Array} arr 支持多种类型：
 *    1. 断言函数：() => boolean，返回false时终止流程
 *    2. 带类型标识：["t","text",delay] 或 ["i","id",delay]或者["c",cahcedButtom,delay]
 *    3. 特殊操作：["c"], ["lc"]
 *    4. 第五个参数 fn(centerX,centerY,w,h)
 */
function afollow(arr) {
    var current
    var regex
    for (let i = 0; i < arr.length; i++) {
        current = arr[i];
        // 处理断言函数
        if (typeof current === 'function') {
            try {
                if (!current()) {
                    clog("断言函数返回false，终止流程");
                    return false;
                }
            } catch (e) {
                clog(`断言函数执行错误: ${e}`);
                return false;
            }
            continue;
        }

        // 处理普通操作项
        let type = "i", p, d = 500, iv;
        
        // 解析参数
        if (Array.isArray(current)) {
            clog("type 1")
            type = current[0].toLowerCase();
            p = current[1];
            d = current[2] || 500;
            iv = current[3];
            fn = current[4];
        } else if (typeof current === 'string') {
            clog("type 2")
            p = current;
            type = p.startsWith("com.") ? "i" : "t";
        } else {
            clog("type 3")
            p = current.p || current.path;
            d = current.d || current.delay || 500;
            iv = current.i || current.interval;
            type = current.type || (p.startsWith("com.") ? "i" : "t");
        }

        // 前置等待
        if (iv) sleep(iv);

        // 处理特殊点击
        if (p === "c") {
            screenCentralClick(d);
            continue;
        } else if (p === "lc") {
            landScapeCentralClick(d);
            continue;
        }

        if(type==="c"){
            if(!fn){
                if(p.existApply(ddclickCenter)){
                    sleep(d)
                    continue
                }else{
                    sleep(d)
                    return false
                }

            }else{
                if(p.existApply(fn)){
                    sleep(d)
                    continue
                }else{
                    sleep(d)
                    return false
                }

            }
        }
        // 执行匹配逻辑
        let comp;
        regex = new RegExp(`.*${escapeRegExp(p)}$`);



        
        try {
            if(type==="t"){
                comp=textMatches(regex).findOne(1000);
            }else if(type==="i"){
                comp=idMatches(regex).findOne(1000);
            }else if(type==="d"){
                comp=descMatches(regex).findOne(1000);
            }else{
                clog("暂不支持 "+type+" 视作d")
                comp=descMatches(regex).findOne(1000);
            } 
            
        } catch (e) {
            clog(`匹配错误: ${e}`);
        }

        if (comp) {
            clog(comp)
            if(fn){
                fn(Math.abs(comp.bounds().centerX()) ,Math.abs(comp.bounds().centerY()),comp.bounds().width(),comp.bounds().height())
            }else{
                click(Math.abs(comp.bounds().centerX()) ,Math.abs(comp.bounds().centerY()))
            }
            sleep(d);
        } else {
            clog(`[${type.toUpperCase()}] 未找到: ${p}`);
            sleep(d);
            return false;
        }
    }
    return true;
}

// 正则表达式转义辅助函数
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * 
 * @param {*} size size[0] w  size[1] h
 * @param {*} pos pos[0] x pos[1] y
 * @returns 
 */
function locateWithSizeAndPos(size,pos,delata){ 
    w=device.width
    h=device.height 
    if(!delata){
        delata=10
    }
    var start=pos[0]*w-(size[0]*w)/2 -delata
    var top=pos[1]*h-(size[1]*h)/2 -delata
    var bt=pos[1]*h+(size[1]*h)/2 +delata
    var end=pos[0]*w+(size[0]*w)/2 +delata
    start=start>=0? start:0
    end=end>=w? w:end
    top=top>=0? top:0
    bt=bt>=h? h:bt 
    
    return boundsInside(start,top,end,bt)
}
/**
 * 
 * @param {*} size size[0] w  size[1] h
 * @param {*} pos pos[0] x pos[1] y
 * @returns 
 */
function locateWithSizeAndPosEqual(size,pos,delata){ 
    w=device.width
    h=device.height 
    if(!delata){
        delata=0
    }
    var start=pos[0]*w-(size[0]*w)/2 -delata
    var top=pos[1]*h-(size[1]*h)/2 -delata
    var bt=pos[1]*h+(size[1]*h)/2 +delata
    var end=pos[0]*w+(size[0]*w)/2 +delata
    start=start>=0? start:0
    end=end>=w? w:end
    top=top>=0? top:0
    bt=bt>=h? h:bt 
    
    return bounds(start,top,end,bt)
}
/**
 * 
 * @param {*} size size[0] w  size[1] h
 * @param {*} pos pos[0] x pos[1] y
 * @returns 
 */
function locatSP(detail,delata){ 
    let size=detail.size
    let pos=detail.pos
    if(!delata) delata=10
    return locateWithSizeAndPos(size,pos,delata)
}
/**
 * 
 * @param {*} size size[0] w  size[1] h
 * @param {*} pos pos[0] x pos[1] y
 * @returns 
 */
function locatSPE(detail,delata){ 
    let size=detail.size
    let pos=detail.pos
    if(!delata) delata=0
    return locateWithSizeAndPosEqual(size,pos,delata)
}
/**
 * 
 * @param {*} selector 
 * @param {*} fn  centerX,centerY,comp
 * @returns 
 */
function canCanNeed(selector,fn){
    // clog(selector)
    const comp = selector.findOne(1000);
    if (comp) {
        // clog(comp)
        if(fn){
            clog("执行")
             fn((comp.bounds().left+comp.bounds().right)/2,(comp.bounds().top+comp.bounds().bottom)/2,comp)
        }else{
            clog("点击")
            comp.click();
        }
        return true
    } 
    console.log("组件不可用");
    return false;
}
/**
 * 
 * @param {*} selector 
 * @param {*} fn  centerX,centerY,comp
 * @returns 
 */
function canCanNeedOne(selector,fn){
    // clog(selector)
    // 获取所有目标组件
    let components = selector.find();
    clog("找到"+components.length )
    // 处理空结果
    if (components.length === 0) {
        toast("没有找到任何组件");
        return false;
    }

    // 核心查找逻辑
    let maxArea = 0;
    let maxComponent = null;

    components.forEach(comp => {
        try {
            const bounds = comp.bounds();
            const width = bounds.right - bounds.left;
            const height = bounds.bottom - bounds.top;
            const area = width * height;
            
            // 比较并更新最大值
            if (area > maxArea) {
                maxArea = area;
                maxComponent = comp;
            }
        } catch (e) {
            console.error("组件异常:", e);
        }
    });
 
    if (maxComponent) {
        clog(maxComponent)
        if(fn){
            clog("执行")
             fn((maxComponent.bounds().left+maxComponent.bounds().right)/2,(maxComponent.bounds().top+maxComponent.bounds().bottom)/2,maxComponent)
        }else{
            clog("点击")
            maxComponent.click();
        }
        return true
    } 
    console.log("组件不可用");
    return false;
}


//如果保证一张图只有一个环，环的颜色唯一
//显然将一张图篇分别旋转四次，
//每次找色获得的坐标进行变换，就可以得到环的top,left,right,end
//就可以便捷地计算圆心

//数学计算
// 计算两点之间的距离
function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

// 计算点集的质心
function calculateCentroid(points) {
    var sumX = 0;
    var sumY = 0;
    var n = points.length;

    for (var i = 0; i < n; i++) {
        sumX += points[i].x;
        sumY += points[i].y;
    }

    return { x: sumX / n, y: sumY / n };
}

// 最小二乘法拟合圆，返回圆心和半径
function fitCircle(points) {
    var centroid = calculateCentroid(points);  // 初步使用质心作为圆心
    var sumRadius = 0;

    // 计算平均半径
    for (var i = 0; i < points.length; i++) {
        sumRadius += calculateDistance(points[i].x, points[i].y, centroid.x, centroid.y);
    }
    
    var radius = sumRadius / points.length; // 半径为平均半径

    return { center: centroid, radius: radius };
}

// 剔除离圆心过远的点
function filterOutliers(points, center, maxDistance) {
    var filteredPoints = [];
    for (var i = 0; i < points.length; i++) {
        var distance = calculateDistance(points[i].x, points[i].y, center.x, center.y);
        if (distance <= maxDistance) {
            filteredPoints.push(points[i]);
        }
    }
    return filteredPoints;
} 

// 颜色点聚类：基于距离
function distance(p1, p2) {
    return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
}

function clusterPoints(points, distanceThreshold) {
    let clusters = [];

    for (let point of points) {
        let added = false;
        for (let cluster of clusters) {
            for (let p of cluster) {
                if (distance(p, point) < distanceThreshold) {
                    cluster.push(point);
                    added = true;
                    break;
                }
            }
            if (added) break;
        }
        if (!added) {
            clusters.push([point]);
        }
    }

    return clusters;
}

// 从一组点拟合圆
function findCircleCenterFromPoints(points) {
    if (!points || points.length === 0) return null;

    let top = points[0], bottom = points[0], left = points[0], right = points[0];

    for (let p of points) {
        if (p.y < top.y) top = p;
        if (p.y > bottom.y) bottom = p;
        if (p.x < left.x) left = p;
        if (p.x > right.x) right = p;
    }

    let centerX = (left.x + right.x) / 2;
    let centerY = (top.y + bottom.y) / 2;
    let radius = ((right.x - left.x) + (bottom.y - top.y)) / 4;

    return {
        center: { x: centerX, y: centerY },
        radius: radius,
        pointCount: points.length
    };
}

// 综合识别多个圆
function findAllCirclesFromPoints(points, distanceThreshold) {
    let clusters = clusterPoints(points, distanceThreshold);
    let results = [];

    for (let cluster of clusters) {
        if (cluster.length < 10) continue; // 噪声点过滤
        let circle = findCircleCenterFromPoints(cluster);
        if (circle) results.push(circle);
    }

    return results;
}



module.exports = {
    getDate: function getDate() {
        return formatDate(new Date())
    },
    dirctions: {
        up: 1,
        down: 1,
        left: 1,
        right: 1
    },
    clickTargetPicCentral,
    clickTargetPicCentralFromPath,
    clickColorfulTargetPicCentralFromPath,
    swipeTargetPicLeft,
    swipeTargetPicLeftFromPath,
    PointInBackground,
    clickAllPicsCentral,
    clickAllPicsCentralFromPath,
    clickTargetPicLeftTop,
    clickTargetPicLeftTopFromPath,
    clickColorfulTargetPicLeftTop,
    clickColorfulTargetPicLeftTopFromPath,
    screenCentralClick,
    clickFromPath,
    startDurationAdDetection,
    startAdDetection,
    stopAdDetction,
    startAdDetectionRound,
    isAdDetctionThraedAlive,
    startBlockingAdDetectionRound,
    startBlockingAdDetectionRoundWith,
    repeatFunction,
    countDownRepeat,
    startBlockingDurationAdDetection,
    findSinglePicFromPathTo,
    findSingleColorfulPicFromPathTo,
    findSinglePicTo,
    findSingleColorfulPicTo,
    startBlockingAdDetection,
    // easyRequestScreenCapture,
    s, //无颜色点击阵列
    cs, //有颜色点击阵列
    fs, //无颜色操作阵列阵列
    cfs, //有颜色操作阵列阵列
    ids, //id操作阵列阵列
    ts, //id操作阵列阵列
    follow, //图片查找操作的可中断流
    tfollow, //text查找操作的可中断流
    idfollow, //id查找操作的可中断流
    afollow, //同意查找操作的可中断流，后续可能加上pic,但是显然这样会非常奇怪
    drawCircleGen, //画圈工具
    createCircleDrawer, //自定义画圈器，锚点可能为负值造成报错，注意centerX,Y
    createAdDetector, //广告检测器
    locateWithSizeAndPos, //定位器
    locatSP, //使用属性的定位器
    locatSPE, //使用属性的定位器
    canCanNeed, //安全调用
    canCanNeedOne, //安全调用
    CachedBT, //缓存类
    autoCachedBT, //自动保存DPI
    getCachedInfo, //获取缓存信息
    enableDPICache, //使能缓存
    findAllCirclesFromPoints,//找多个圆
    create2PointGenerator
};
 