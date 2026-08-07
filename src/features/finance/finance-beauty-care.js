(() => {
  const BEAUTY_CARE_CATEGORY = Object.freeze({
    id: "haircare",
    label: "Beauty care",
    hint: "Hair, face and other beauty care",
    subcategories: Object.freeze(["Hair", "Face", "Other"]),
  });
  const LEGACY_SUBCATEGORIES = Object.freeze({
    Haircut: "Hair",
    "Hair products": "Hair",
    "Other haircare": "Other",
  });

  function remapBeautyCareCategory(category) {
    if (!category || category.id !== BEAUTY_CARE_CATEGORY.id) return category;
    return {
      ...category,
      ...BEAUTY_CARE_CATEGORY,
      subcategories: [...BEAUTY_CARE_CATEGORY.subcategories],
    };
  }

  function remapBeautyCareCategories(categories) {
    if (!categories || typeof categories !== "object") return categories;
    return {
      ...categories,
      expense: (categories.expense || []).map(remapBeautyCareCategory),
    };
  }

  const fallbackIndex = FALLBACK_CATEGORIES.expense.findIndex(
    (category) => category.id === BEAUTY_CARE_CATEGORY.id,
  );
  if (fallbackIndex !== -1) {
    FALLBACK_CATEGORIES.expense[fallbackIndex] = remapBeautyCareCategory(
      FALLBACK_CATEGORIES.expense[fallbackIndex],
    );
  }

  financeCategories = remapBeautyCareCategories(financeCategories);

  const normalizeFinanceCategories = normalizeCategories;
  normalizeCategories = function normalizeBeautyCareCategories(categories) {
    return remapBeautyCareCategories(normalizeFinanceCategories(categories));
  };

  const renderFinanceSubcategories = updateSubcategories;
  updateSubcategories = function updateBeautyCareSubcategories(selected = "") {
    return renderFinanceSubcategories(LEGACY_SUBCATEGORIES[selected] || selected);
  };
})();
