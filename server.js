
//to make server
var express=require('express');
//In order to take  informations in downloaded file
var cheerio = require('cheerio');
//to make request
var request=require('request');
//var async=require('async.js');
var waterfall = require('async-waterfall');
//In order to server works
var app=express();
var urlMichelin="https://restaurant.michelin.fr/restaurants/paris/page-";
var MongoClient = require("mongodb").MongoClient;
var port=3500;
var categorie,iString="",jString="",i=0,j=0,e="",id=1,pages=2,michelinURL="https://restaurant.michelin.fr";
var laFourchetteURL="https://www.lafourchette.com/recherche/autocomplete?searchText=";
var EndUrl = "&localeCode=fr";
var objNew;
var database;
var cron = require('node-schedule');

// Il nous faut ObjectID
var MongoObjectID = require("mongodb").ObjectID;
app.use(express.static(__dirname + '/public'));

app.get('/projet', function(req, res) {

//Pour gérer les fonctions d'une maniére synchrones.


var rule = new cron.RecurrenceRule();
rule.hour = 6;


waterfall([


  function(callback){

  	RestaurantMichelin();
  	ReadDataBase();

    callback(null);
  },
 function(callback){
   cron.scheduleJob(rule, function(){
      RestaurantLaFourchette();
   });


  	callback(null,"done");
  }

], function (err, result) {
   console.log(result);
});



function RestaurantMichelin(){

	MongoClient.connect("mongodb://localhost/WebApplication", function(error, db) {
		if (error) return funcCallback(error);
		console.log("Connecté à la base de données pour RestaurantMichelin()");

		for(i = 1;i<pages;i++){   // nbre de page de recherche Paris guide Michelin

			iString= i.toString();
			urlPage= urlMichelin+iString;

			request(urlPage, function (error, response, body) {

				for (j = 1; j < 18; j++) {  // nbre de restaurant sur une page
			    	jString= j.toString();
					var $ = cheerio.load(body),
					e=$("#panels-content-main-leftwrapper > div.panel-panel.panels-content-main-left > div > div > ul > li:nth-child("+jString+") > div > a > div.poi_card-picture > div > div > span");

					if(e == '<span class="guide-icon icon-mr icon-cotationAssiette"></span>'){
						categorie="Assiette";
					}
					else if(e == '<span class="guide-icon icon-mr icon-cotation1etoile"></span>'){
						categorie="1etoile";
					}
					else if(e == '<span class="guide-icon icon-mr icon-cotation2etoiles"></span>'){
						categorie="2 etoiles";
					}
			       	else if(e== '<span class="guide-icon icon-mr icon-cotation3etoiles"></span>'){
						categorie="3 etoiles";
					}
					else if(e=='<span class="guide-icon icon-mr icon-cotationBibGourmand"></span>'){
						categorie="BibGourmand";
					}
					else categorie="Pas d'indication";

			    	name = $("#panels-content-main-leftwrapper > div.panel-panel.panels-content-main-left > div > div > ul > li:nth-child("+jString+") > div > a > div.poi_card-details > div.poi_card-description > div.poi_card-display-title").text().trim();
			    	site = $("#panels-content-main-leftwrapper > div.panel-panel.panels-content-main-left > div > div > ul > li:nth-child("+jString+") > div > a").attr("href");
					michelinURL=michelinURL+site;

					//Je creer le nouvel doc qui va être inséré
					objNew={_id:id,Name:name,Categorie:categorie,MichelinUrl:michelinURL};
					//j'insère l'elements dans la base de données MongoDB
					db.collection("restaurant").save(objNew,null,function(error,result){
					if (error) throw error;
						console.log("Le document a bien été inséré");
					});
					console.log("restaurant  = " +name);
					console.log(" michelin url = "+ michelinURL );
					console.log("categorie = "+ categorie );
				  	console.log("\n")
				  	michelinURL="https://restaurant.michelin.fr";
				  	id++;
				}
			});
		}
	});
}


function RestaurantLaFourchette(){


	id_resto="";

	MongoClient.connect("mongodb://localhost/WebApplication", function(error, db) {
		if (error) return funcCallback(error);
		console.log("Connecté à la base de données pour RestaurantLaFourchette()");

		db.collection("restaurant").find().toArray(function (error, results) {
			if (error) throw error;

			results.forEach(function(element) {


			    laFourchetteURL='https://www.lafourchette.com/recherche/autocomplete?searchText='+'"'+element.Name.replace(" ","+")+'"'+'&localeCode=fr';

			    laFourchetteURL = decodeURI(laFourchetteURL);

			    console.log(laFourchetteURL);



			    // ici Fonction url

				request(laFourchetteURL,function(error, response, body)
				{
				    const result = JSON.parse(body)
				    // console.log("laFourchetteURL_json = " + laFourchetteURL_json);
				    //console.log("Got a response: ", result.data);

					//Ici faire la vérification du restaurant qui nous interesse.
					for(i=0;i<result.data.restaurants.length;i++){

						VilLeFourchette=result.data.restaurants[i].city.trim();

			              if (VilLeFourchette=="Paris"){
			                  id_resto = result.data.restaurants[i].id_restaurant;
			                  console.log("id_restaurant = "+id_resto);
			                  break;
			                //"id_restaurant": "210947",
			                }
					}

					//objNew={_id:element._id,Name:element.Name,Categorie:element.Categorie,MichelinUrl:element.MichelinUrl,idLaFourchette:id_resto};
					//j'insère l'elements dans la base de données MongoDB
					//db.collection("restaurant").save(objNew,null,function(error,result){
					//	if (error) throw error;
						//console.log("L'ID a bien été rajouté");
					//});


					//Requette avec l'ID pour aller sur la page des promotions du restaurant en question
					laFourchetteURL= "https://www.lafourchette.com/restaurant/"+element.Name.replace("","-")+"/"+id_resto;

				    request(laFourchetteURL,function  (error, response, body) {
				    	var $ = cheerio.load(body),
						nom_restaurant= $('#content > summary > div > div.restaurantSummary-summaryWrapper.col-xs-9 > h1').text()
						addresse_restaurant = $('#content > summary > div > div.restaurantSummary-summaryWrapper.col-xs-9 > div:nth-child(2) > span').text().trim()
				        promotion = $('#ocSaleTypeList > section > div.saleType.saleType--specialOffer > h3').text()
				        promotion_menu = $('#ocSaleTypeList > section > div.saleType.saleType--specialOffer > p').text();


                objNew={_id:element._id,Name:element.Name,Categorie:element.Categorie,MichelinUrl:element.MichelinUrl,idLaFourchette:id_resto,Promotion:promotion,promotion_menu:promotion_menu};
                //probleme de repetition dans la base de donnee 

				        db.collection("restaurant").save(objNew,null,function(error,result){
						if (error) throw error;
						//console.log("L'ID a bien été rajouté");
						});

						console.log(nom_restaurant)
						console.log(addresse_restaurant)
				        console.log(promotion);
				        console.log(promotion_menu);
						console.log("\n")

				    });
				});
			});
		});
	});
}

function Promotion(){

	MongoClient.connect("mongodb://localhost/WebApplication",function(error, db) {
		if (error) return funcCallback(error);
		db.collection("restaurant").find().toArray(function (error, results) {
			if (error) throw error;

			results.forEach(function(element) {

				laFourchetteURL="https://www.lafourchette.com/restaurant/"+element.Name.replace("","-")+"/"+element.idLaFourchette;

				request(laFourchetteURL,function  (error, response, body) {
						var $ = cheerio.load(body),
						nom_restaurant= $('#content > summary > div > div.restaurantSummary-summaryWrapper.col-xs-9 > h1').text()
						addresse_restaurant = $('#content > summary > div > div.restaurantSummary-summaryWrapper.col-xs-9 > div:nth-child(2) > span').text().trim()
				        promotion = $('#ocSaleTypeList > section > div.saleType.saleType--specialOffer > h3').text()
				        promotion_menu = $('#ocSaleTypeList > section > div.saleType.saleType--specialOffer > p').text();
						console.log(nom_restaurant)
						console.log(addresse_restaurant)
				        console.log(promotion);
				        console.log(promotion_menu);
						console.log("\n")
				});
			});
		});
	});
}

function ReadDataBase(){


	MongoClient.connect("mongodb://localhost/WebApplication", function(error, db) {
		if (error) return funcCallback(error);
		console.log("Connecté à la base de données 'WebApplication'");
		db.collection("restaurant").find().toArray(function (error, results) {
			if (error) throw error;

      var names=[];
      var categories=[];
      var urlMichelins=[];
      var promotions=[];
      var promotion_menus=[];
			results.forEach(function(element) {

          names.push(element.Name);
          categories.push(element.Categorie);
          urlMichelins.push(element.MichelinUrl);
          if(element.Promotion != "")
          {
                promotions.push(element.Promotion);
                promotion_menus.push(element.promotion_menu);
          }
          else
          {
                promotions.push("Pas de promotions pour le moment");
                promotion_menus.push("");
          }


      });

      res.render('recherche.ejs',{Names:names,Categories:categories,UrlMichelins:urlMichelins,Promotions:promotions,Promotion_Menus:promotion_menus});
			});

	})
}


function ConnectDataBase(){

		MongoClient.connect("mongodb://localhost/WebApplication", function(error, db) {
	    	if (error) return funcCallback(error);
			console.log("Connecté à la base de données 'WebApplication'");

			database= db;

		})
}
})



app.listen(port);
console.log("express server is listening on port "+port);
