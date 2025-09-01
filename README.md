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
 
### Exporting the classified composites:
- Since GEE doesn't compute anything until an action is triggered (in this case, export), exporting the final classified image of each method separately without any prior heavy computations (adding map layers, matrix calculations, etc.) can act as a proxy for computational effort of each method. 
  - So, to measure computational effort, make the code blocks with [C] markers  next to them into comments, then run the export to measure EECU seconds.



## Outputs:
- 2 TIFFs: S2_Classified_Image, Embeddings_Classified_Image
- 2 PNGs of the composites
- 2 confusion matrices



## Results:
### For Sentinel-2 Dataset:
#### Accuracy:
- Confusion Matrix:

| True\Predicted     | Urban (0) | Bare (1) | Water (2) | Vegetation (3) | **PA** |
|------------------|-----------|----------|-----------|----------------|-----------------|
| **Urban (0)**    | 42        | 11       | 1         | 4              | **0.724** |
| **Bare (1)**     | 5         | 54       | 0         | 0              | **0.915** |
| **Water (2)**    | 0         | 0        | 61        | 5              | **0.924** |
| **Vegetation (3)**| 11       | 1        | 3         | 42             | **0.737** |
| **CA** | **0.724** | **0.818** | **0.938** | **0.824** | **OA = 0.829** |

- Overall Accuracy: 0.829

#### Effort:
- Human Effort (Lines of code and task steps): 72 lines of code, 11 steps
- Computational effort (average batch compute usage in EECU-seconds during export): 40449.826175


### For Satellite Embeddings Dataset:
#### Accuracy:
- Confusion Matrix:

| True\Predicted    | Urban (0) | Bare (1) | Water (2) | Vegetation (3) | **PA** |
|------------------|-----------|----------|-----------|----------------|-----------------|
| **Urban (0)**    | 49        | 4        | 0         | 5              | **0.845** |
| **Bare (1)**     | 5         | 54       | 0         | 0              | **0.915** |
| **Water (2)**    | 1         | 0        | 62        | 3              | **0.939** |
| **Vegetation (3)**| 1        | 1        | 0         | 55             | **0.965** |
| **CA** | **0.875** | **0.915** | **1.000** | **0.873** | **OA = 0.917** |

- Overall Accuracy: 0.917

#### Effort:
- Human Effort (Lines of code and task steps): 50 lines of code, 8 steps
- Computational effort (average batch compute usage in EECU-seconds during export): 4656.059125



## Conclusion:
- It could be seen that AI Satellite Embeddings yielded higher overall accuracy (OA 0.917 vs. 0.829) and higher reliability (higher CA for all classes), while also reducing both human effort (fewer lines of code and steps) and computational effort (an order of magnitude lower EECU-seconds). 
- These findings mean that AI-integrated datasets can help streamline workflows of land cover classification projects by reducing data-preprocessing requirements. However, traditional datasets and workflows remain valuable when data interpretability is needed. Indices, such as NDVI, NDBI, and MNDWI used above, have clear physics and provide physical explanations that pure embedding-based approaches can’t fully replace yet.
- It is important to run this analysis (or a more rigorous version of it) over multiple regions with different land compositions and sizes before drawing broader conclusions about the general applicability of these findings.



## Notes:
- TIFF and PNG outputs are included in a separate folder.
- JavaScript code from GEE code editor is given in GEE_code.js file.
- The lines of code and steps for Satellite Embeddings Dataset also include the FeatureCollection, Filtering, and GCPs steps that were re-used. The lines of code for both methods do not include the exports.
- This project is licensed under the MIT License.






   


