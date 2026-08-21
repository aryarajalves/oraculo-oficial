import React from 'react';
import UploadModal from './UploadModal';
import DeleteImageModal from './DeleteImageModal';
import ImageDetailsModal from './ImageDetailsModal';
import SaveGeneratedModal from './SaveGeneratedModal';

export default function BibliotecaModals({
  uploadModalOpen,
  setUploadModalOpen,
  loadLibrary,
  categories,
  deleteModalOpen,
  setDeleteModalOpen,
  imageToDelete,
  setImageToDelete,
  handleConfirmDelete,
  batchDeleteModalOpen,
  setBatchDeleteModalOpen,
  selectedForBatch,
  handleConfirmBatchDelete,
  deleting,
  detailsModalOpen,
  setDetailsModalOpen,
  selectedImageForDetails,
  setSelectedImageForDetails,
  itemToSave,
  setItemToSave,
  handleConfirmSaveGenerated,
  savingItem,
  showToast
}) {
  return (
    <>
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={() => loadLibrary()}
        existingCategories={categories}
        showToast={showToast}
      />

      {/* Modal de Exclusão Individual */}
      <DeleteImageModal
        isOpen={deleteModalOpen}
        image={imageToDelete}
        count={1}
        onClose={() => { setDeleteModalOpen(false); setImageToDelete(null); }}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />

      {/* Modal de Exclusão em Lote */}
      <DeleteImageModal
        isOpen={batchDeleteModalOpen}
        count={selectedForBatch.length}
        onClose={() => setBatchDeleteModalOpen(false)}
        onConfirm={handleConfirmBatchDelete}
        deleting={deleting}
      />

      <ImageDetailsModal
        isOpen={detailsModalOpen}
        image={selectedImageForDetails}
        onClose={() => { setDetailsModalOpen(false); setSelectedImageForDetails(null); }}
        onSaveMetadata={() => loadLibrary()}
        showToast={showToast}
      />

      {/* Modal de Confirmação e Título/Prompt para Salvar Imagem Gerada */}
      <SaveGeneratedModal
        isOpen={!!itemToSave}
        item={itemToSave}
        onClose={() => setItemToSave(null)}
        onConfirmSave={handleConfirmSaveGenerated}
        saving={savingItem}
      />
    </>
  );
}
