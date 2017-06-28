var express = require('express')
var router = express.Router();
var mongoose = require('mongoose');
var co = require('co');
mongoose.connect('mongodb://localhost/myproject');


var db = mongoose.connection;
db.on('error', () => console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log("We`re Connected");
});
var jobScheme = mongoose.Schema({
    salary: String,
    newsalary: String,
    period: String,
    num: Number
}, { collection: 'refine' });
var statsScheme = mongoose.Schema({
    totalrefined: Number,
    havenoSalary: Number,
    numMonthly: Number,
    numAnually: Number,
    numNoPeriod: Number,
    timestamp: Number,
    type: String,
    categories: String,
    site: String,
    total: Number
}, { collection: 'stats' });

var jobCollection = mongoose.model('job', jobScheme);
var statsCollection = mongoose.model('stats', statsScheme);


router.get('/test', (req, res) => {
    res.send("Hello World There");
});

async function getTimeRecords(){
     return statsCollection.aggregate([{
            $group: {
                        _id: "$timestamp",
                    }
        }]);
}
async function getClosestTimeRecord(time){
    var timeList = await getTimeRecords();
    var newList =timeList.map( (val,ind,timeList) => {
            return parseInt(val._id)} );
    //console.log("getting closest Time");
    //console.log(newList);
    //console.log("max = " + Math.max.apply(null,newList));
    if (isNaN(time))
        return Math.max.apply(null,newList);
    //console.log("not max");
    return timeList.reduce((prev,curr) =>{
        return (Math.abs(curr._id - time) < Math.abs(prev._id - time) ? curr : prev);
    })._id;

    
        
}
async function getCategories() {
    try {
        console.log("getting");
        return  jobCollection.aggregate([
            {
                $group: {
                    _id: "$type"
                }
            }
        ]);
    }
    catch (err) {
        console.error(err);
        throw err;
    }
}


async function validCategory(chosenCat) {
    try {
        var categories = await getCategories();
        var refinedcategories = await categories.map((x) => { return x["_id"] });
    }
    catch (err) {
        console.log("error");
        return "";
    }
    return (!((!chosenCat) || (refinedcategories.indexOf(chosenCat) == -1)));
}


router.get('/getCategories', (req, res) => {
    co(function* () {
        //console.log("routing");
        var categories = yield getCategories();
        categories ? res.json(categories) : res.status(500).send("Something Broke");
    });
});

// //get job summary stats per category
router.get('/getJobSummary/:category', (req, res) => {
    co(function* () {

        try {
            var agg = new mongoose.Aggregate();
            var chosenCat = req.params["category"];
            if (yield validCategory(chosenCat))
                agg.append([{ $match: { type: chosenCat } }]);

            agg.append({
                $match: {
                    $or: [{ period: "monthly" }, { period: "annually" }],
                    num: { $gt: 10000, $lte: 300000 }
                }
            },
                {
                    $project: {
                        num: 1,
                        norm: {
                            $cond: {
                                if: { $eq: ["$period", "monthly"] },
                                then: { $trunc: { $divide: [{ $multiply: ["$num", 12] }, 100000] } },
                                else: { $trunc: { $divide: ["$num", 100000] } }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: "$norm",
                        cat: { $first: "$num" },
                        count: { $sum: 1 }
                    }
                });

            //execute
            agg.model(jobCollection);
            var result = yield agg.exec();
            res.json(result);
        }
        catch (err) {
            console.error(err);
            res.status(500).send("Something Broke");
            throw err;
        }


    })
});
router.get('/getJobScrapeTimes',
    async function (req, res) {
        try{        
                      
           // var closestTime =await getClosestTimeRecord(parseInt(req.params.time));
        //console.log("Time :" + req.params.time);
        //console.log("closest Time : " + closestTime);
        res.json(await getTimeRecords());
    }
    catch(err){console.error(err);}

    });
router.get('/getJobStats/:category', 
    async function (req, res) {
        try {
            
            var agg = new mongoose.Aggregate();
            var chosenCat = req.params.category;
            var time= req.query.time;
            
            
            console.log(chosenCat);


            var closestTime = await getClosestTimeRecord(parseInt(time));
            console.log("Time : " + time);
            console.log("Closest Time: " +closestTime);
            agg.append([
                {
                    $match: { timestamp: closestTime }
                }
            ]);
        //query by time
            if (await validCategory(chosenCat)) {
                agg.append([{ $match: { type: chosenCat } }]);                
                console.log("proper");  
            } else {  
                console.log("not proper");              
                agg.append([
                    {
                        $group: {
                            _id: "$timestamp",
                            totalrefined: { $sum: "$totalrefined" },
                            havenoSalary: { $sum: "$havenoSalary" },
                            numMonthly: { $sum: "$numMonthly" },
                            numAnually: { $sum: "$numAnually" },
                            numNoPeriod: { $sum: "$numNoPeriod" },
                            total: { $sum: "$total" },
                            timestamp: { $first: "$timestamp" },
                            categories: { $first: "$categories" },
                            site: { $first: "$site" },
                        }
                    }
                ]);
            }
            agg.append([
                {
                    $sort: { timestamp: -1 }
                },
                {
                    $limit: 1
                }
            ]);
            agg.model(statsCollection);
            var result = await agg.exec();
            res.json(result);
        }
        catch (err) {
            console.error(err);
            res.status(500).send("Something Broke");
            throw err;
        }
    
});



router.get('/job', (req, res) => {
    jobCollection.aggregate([
                    {
            $match: { $or: [{ period: "monthly" }, { period: "annually" }] }
        },
        {
            $project: {
                num: 1,title:1,salary:1,link:1,site:1,type:1,newsalary:1,period:1,
                nom: {
                    $cond: {
                        if: { $eq: ["$period", "monthly"] },
                        then: { $multiply: ["$num", 12]  },
                        else: "$num"
                    }
                }
                
            }
        },
        {
            $match: { nom: { $gt: 10000, $lte: 5000000 } }
        },
        {
            $sort: {nom: -1 }
        }
    ], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send("Something Broke");
        } else {
            res.json(result);
        }
    }
    );

});
module.exports = router;