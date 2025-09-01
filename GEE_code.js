// Supervised Classification using Sentinel-2 dataset******************************************************************
// Imports
var boundary = ee.FeatureCollection('FAO/GAUL_SIMPLIFIED_500m/2015/level2').filter(ee.Filter.eq('ADM2_NAME', 'Cambridgeshire'))
var geometry = boundary.geometry()
Map.centerObject(geometry, 9)

var year = 2021
var start_date = ee.Date.fromYMD(year, 1, 1)
var end_date = start_date.advance(1, 'year')

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
var s2_filtered = s2.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
.filter(ee.Filter.date(start_date, end_date))
.filter(ee.Filter.bounds(geometry))


// Cloud masking
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED')
var csPlusBands = csPlus.first().bandNames()
var s2_withCS = s2_filtered.linkCollection(csPlus, csPlusBands)

function maskLowQA(image){
  var qaBand = 'cs';
  var clearThreshold = 0.6
  var mask = image.select(qaBand).gte(clearThreshold)
  return image.updateMask(mask)}

var s2_composite = s2_withCS.map(maskLowQA).select('B.*').median()


// Calculating indices (NDVI, NDBI, MNDWI), slope, and elevation
  // Indices
function calc_indices(image){
  var NDVI = image.normalizedDifference(['B8', 'B4']).rename(['ndvi'])
  var NDBI = image.normalizedDifference(['B11', 'B8']).rename(['ndbi'])
  var MNDWI = image.normalizedDifference(['B3', 'B11']).rename(['mndwi'])
  return image.addBands(NDVI).addBands(NDBI).addBands(MNDWI)}

var s2_composite = calc_indices(s2_composite)

  // Slope and Elevation (using ALOS World 3D)
var alos = ee.ImageCollection('JAXA/ALOS/AW3D30/V4_1')
var proj = alos.first().projection()
var elevation = alos.select('DSM').mosaic().setDefaultProjection(proj).rename('elevation')
var slope = ee.Terrain.slope(elevation).rename('slope')

var s2_composite = s2_composite.addBands(elevation).addBands(slope).clip(geometry)
print(s2_composite) // To confirm the band list


// Generating training and validation points
  // Generating gcps from reference (ESA World Cover 10m 2021)
var reference = ee.Image('ESA/WorldCover/v200/2021').select('Map') // WorldCover code for land cover class
var reclassified = reference // Reclassifying based on requirements (0 Urban, 1 Bare, 2 Water, 3 Vegetation)
  .where(reference.eq(10), 3)
  .where(reference.eq(20), 3)
  .where(reference.eq(30), 3)
  .where(reference.eq(40), 3)
  .where(reference.eq(50), 0)
  .where(reference.eq(60), 1)
  .where(reference.eq(70), 1)
  .where(reference.eq(80), 2)
  .where(reference.eq(90), 2)
  .where(reference.eq(95), 3)
  .where(reference.eq(100), 1)
var gcps = reclassified.stratifiedSample({
  numPoints: 200,
  classBand: 'Map', 
  region: geometry,
  scale: 10,
  seed: 42,
  geometries: true}) // To make into a FeatureCollection 

 // Splitting gcps into training and validation gcps (70/30)
var gcps_random = gcps.randomColumn()
var gcps_training = gcps_random.filter(ee.Filter.lt('random', 0.7))
var gcps_validation = gcps_random.filter(ee.Filter.gte('random', 0.7))

 // Overlay training gcps on composite to get trainig points with class and band, indices, elevation, slope data
var s2_training_points = s2_composite.sampleRegions({
  collection: gcps_training,
  properties: ['Map'],
  scale: 10})

 // Train classifier
var s2_classifier = ee.Classifier.smileRandomForest(50).train({ 
  features: s2_training_points,
  classProperty: 'Map', // what will be predicted (class of each pixel)
  inputProperties: s2_composite.bandNames()}) // what will be used to based the prediction on (contained bands)

 // Classify the composite using the trained classifier
var s2_classified = s2_composite.classify(s2_classifier)
Map.addLayer(s2_classified.clip(geometry), {min: 0, max: 3, palette: ['magenta', 'yellow', 'blue', 'green']}, 'Classified S2 Image') // [C]


// Accuracy Assessment
  // Overlay validation gcps on composite to get validation points with class and band, indices, elevation, slope data
var s2_validation_points = s2_composite.sampleRegions({
  collection: gcps_validation,
  properties: ['Map'],
  scale: 10})

  // Classify the validation points using the trained classifier from above, then getting the confusion matrix [C]
var s2_test = s2_validation_points.classify(s2_classifier)
var s2_test_confusion_matrix = s2_test.errorMatrix('Map', 'classification')
print(s2_test_confusion_matrix)
print(s2_test_confusion_matrix.accuracy()) // Overall Accuracy
print(s2_test_confusion_matrix.producersAccuracy()) // Producer's Accuracy
print(s2_test_confusion_matrix.consumersAccuracy()) // Consumer's Accuracy


// Supervised Classification using Satellite Embedding V1 dataset******************************************************************
// Imports
var embeddings = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
var embeddings_filtered = embeddings.filter(ee.Filter.date(start_date, end_date)).filter(ee.Filter.bounds(geometry))
var embeddings_image = embeddings_filtered.mosaic().clip(geometry)


// Generating training and validation points
 // Overlay training gcps on the embedding image to get trainig points with class and embeddings data
var emb_training_points = embeddings_image.sampleRegions({
  collection: gcps_training,
  properties: ['Map'],
  scale: 10})
  
  // Train classifier
var emb_classifier = ee.Classifier.smileRandomForest(50).train({ 
  features: emb_training_points,
  classProperty: 'Map', // what will be predicted (class of each pixel)
  inputProperties: embeddings_image.bandNames()}) // what will be used to based the prediction on (embedding values of each pixel)
  
 // Classify the composite using the trained classifier
var emb_classified = embeddings_image.classify(emb_classifier)
Map.addLayer(emb_classified.clip(geometry), {min: 0, max: 3, palette: ['magenta', 'yellow', 'blue', 'green']}, 'Classified Embedding Image') // [C]


// Accuracy Assessment
  // Overlay validation gcps on the embedding image to get trainig points with class and embeddings data
var emb_validation_points = embeddings_image.sampleRegions({
  collection: gcps_validation,
  properties: ['Map'],
  scale: 10})

  // Classify the validation points using the trained classifier from above, then getting the confusion matrix [C]
var emb_test = emb_validation_points.classify(emb_classifier)
var emb_test_confusion_matrix = emb_test.errorMatrix('Map', 'classification')
print(emb_test_confusion_matrix)
print(emb_test_confusion_matrix.accuracy()) // Overall Accuracy
print(emb_test_confusion_matrix.producersAccuracy()) // Producer's Accuracy
print(emb_test_confusion_matrix.consumersAccuracy()) // Consumer's Accuracy


// Exports******************************************************************
Export.image.toDrive({
  image: s2_classified.clip(geometry).visualize({min: 0, max: 3, palette: ['magenta', 'yellow', 'blue', 'green']}),
  description: 'S2_Classified_Image',
  folder: 'Project_Traditional_AI',
  fileNamePrefix: 'S2_Classified_Image',
  region: geometry,
  scale: 10,
  maxPixels: 1e10})
  
Export.image.toDrive({
  image: emb_classified.clip(geometry).visualize({min: 0, max: 3, palette: ['magenta', 'yellow', 'blue', 'green']}),
  description: 'Embeddings_Classified_Image',
  folder: 'Project_Traditional_AI',
  fileNamePrefix: 'Embeddings_Classified_Image',
  region: geometry,
  scale: 10,
  maxPixels: 1e10})
