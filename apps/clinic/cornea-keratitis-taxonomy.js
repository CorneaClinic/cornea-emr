(function (global) {
  'use strict';
  global.CorneaKeratitisTaxonomy = {
    ETIOLOGIES: ['Bacterial', 'Fungal', 'Viral (HSV)', 'Viral (HZV)', 'Acanthamoeba', 'Mixed', 'Unknown'],
    STATUSES: ['Active', 'Healing', 'Resolved', 'Referred'],
    DEPTHS: ['Epithelial', 'Superficial stromal', 'Deep stromal', 'Perforation risk'],
    HEALING: ['Improved', 'Unchanged', 'Worse'],
    SPECIMEN_TYPES: ['Corneal scrape', 'Tear film', 'Contact lens', 'Biopsy'],
    GRAM: ['Gram positive', 'Gram negative', 'Gram variable', 'No organisms', 'Not done']
  };
})(typeof window !== 'undefined' ? window : globalThis);
