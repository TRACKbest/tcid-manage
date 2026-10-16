import Swal from 'sweetalert2'

const confirmLogout = async (text = 'Votre session sera fermée.') => {
  const result = await Swal.fire({
    title: 'Voulez-vous vous déconnecter ?',
    text,
    icon: 'warning',
    showCloseButton: true,
    showCancelButton: true,
    confirmButtonText: 'Déconnexion',
    cancelButtonText: 'Annuler',
    confirmButtonColor: '#f15b61',
    cancelButtonColor: '#bcbcbc',
    reverseButtons: true,
    focusCancel: true,
  })
  return result.isConfirmed
}

export default confirmLogout