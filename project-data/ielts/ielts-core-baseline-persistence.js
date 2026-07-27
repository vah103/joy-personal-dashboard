const coreStateNormal=normal;
normal=function(value){
  const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  const stored=source.weeklyReviews?.__learnerBaseline;
  if(stored&&typeof stored==="object"){
    if(!source.learnerProfile&&stored.learnerProfile)source.learnerProfile=stored.learnerProfile;
    if(!source.diagnostics&&stored.diagnostics)source.diagnostics=stored.diagnostics;
  }
  return coreStateNormal(source);
};
const coreStateSave=save;
save=function(){
  app.data.weeklyReviews=obj(app.data.weeklyReviews);
  app.data.weeklyReviews.__learnerBaseline={
    learnerProfile:app.data.learnerProfile,
    diagnostics:app.data.diagnostics,
    updatedAt:Date.now(),
  };
  coreStateSave();
};