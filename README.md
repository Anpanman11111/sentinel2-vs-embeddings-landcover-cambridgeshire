# sentinel2-vs-embeddings-landcover-cambridgeshire
This project measured the accuracy and effort needed to perform supervised classification over the Cambridgeshire area using a traditional dataset (Sentinel-2) compared to AI satellite embedding (Satellite Embedding V1). Accuracy was measured using confusion matrices, and effort was quantified using lines of code and task steps (human effort), as well as batch compute usage in EECU seconds (computational effort).

## Data Sources:
- Harmonized Sentinel-2 MSI: MultiSpectral Instrument, Level-2A (SR): ESA. Imported from EE data catalog (ID: “COPERNICUS/S2_SR_HARMONIZED”)
- Google’s Cloud Score+ Mask: Google Earth Engine Team. Imported from EE data catalog (ID: "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
- FAO GAUL 500m Simplified: Global Administrative Unit Layers 2015, Second-Level Administrative Units: FAO UN. Imported from EE data catalog (ID: “FAO/GAUL_SIMPLIFIED_500m/2015/level2”)
- ALOS DSM: Global 30m v4.1: JAXA. Imported from EE data catalog (ID: “JAXA/ALOS/AW3D30/V4_1”)
- ESA WorldCover 10m v200: ESA WorldCover Consortium. Imported from EE data catalog (ID: “ESA/WorldCover/v200/2021”)
- Satellite Embedding V1: Google DeepMind. Imported from EE data catalog (ID: “GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL”)

## Tools used and parameters for supervised classification steps:
- Google Earth Engine (JavaScript API)
- Scale: 10, Seed: 42, ee.Classifier.smileRandomForest(50)

## Steps:
### For Sentinel-2 Dataset:
- Data Pre-Processing:
  - Imported FAO/GAUL_SIMPLIFIED_500m/2015/level2 FeatureCollection, filtered for Cambridgeshire, and created AOI geometry.
  - Imported and filtered COPERNICUS/S2_SR_HARMONIZED ImageCollection based on this geometry and dates for 2021.
  - Imported GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED ImageCollection and linked it to the Sentinel-2 ImageCollection. Applied a cloud-masking function that retained only pixels with a CS+ cloud score ≥ 0.6. The cloud-masked sentinel-2 ImageCollection was then made into a median composite.
 
- Calculations:
  - Calculated the indices from the median composite (NDVI, NDBI, MNDWI) using .normalizedDifference(). This combination of indices was chosen because they capture complementary signals (vegetation, urban, and water), separating the main classes while maintaining simplicity.
  - Imported JAXA/ALOS/AW3D30/V4_1 ImageCollection and used it to calculate elevation. Slope was derived from this elevation using ee.Terrain.slope().

- Supervised Classification:
  - Imported ESA/WorldCover/v200/2021 image and reclassified the dataset using .where() into 4 classes:
    - Urban (0): 50
    - Bare (1): 60, 70, 100
    - Water (2): 80, 90
    - Vegetation (3): 10, 20, 30, 40, 95
  - Generated 200 GCPs with the re-classified ImageCollection using .stratifiedSample(). GCPs were then separated into training and validation gcps at a 70/30 ratio.
  - Generated training points by overlaying training GCPs on the median composite using .sampleRegions(). This contains both class and band data for each pixel.
  - Trained the classifier with training points and used it to classify the median composite.
  - Generated validation points by overlaying validation GCPs on the median composite using .sampleRegions().
  - Used the trained classifier to classify validation points and generated a confusion matrix using .errorMatrix().


### For Satellite Embeddings Dataset:
- Data Pre-Processing
  - Imported GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL ImageCollection and filtered it using the AOI geometry and 2021 date. The filtered ImageCollection was then made into a mosaic composite to not alter the embedding values of each pixel.
 
- Supervised Classification (Keeping all parameters the same as above)
  - Used the training and validation GCPs from above to generate training points by overlaying training GCPs on the mosaic composite using .sampleRegions().
  - Trained the classifier with training points and used it to classify the mosaic composite.
  - Generated validation points by overlaying validation GCPs on the mosaic composite using .sampleRegions().
  - Used the trained classifier to classify validation points and generated a confusion matrix using .errorMatrix().
 

### For Satellite Embeddings Dataset:
- Since GEE doesn't compute anything until an action is triggered (in this case, export), exporting the final classified image of each method separately without any prior heavy computations (adding map layers, matrix calculations, etc.) can act as a proxy for computational effort of each method. 
  - So, to measure computational effort, make the code blocks with [C] markers  next to them into comments, then run the export to measure EECU seconds.





   


