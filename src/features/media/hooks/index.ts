// The media feature's hooks entry point: other features import photos/renders hooks from here
// (README → Architecture: cross-feature imports go through hooks/domain, never data/).
export { usePhotos, useUploadPhotos, useUpdatePhoto, useDeletePhoto } from "./use-photos";
export { useRenders, useSaveRender, useDeleteRender, useToggleRenderVisible } from "./use-renders";
