import Swal from 'sweetalert2';

const baseOptions = () => { const s = getComputedStyle(document.documentElement); return { background:s.getPropertyValue('--surface').trim()||'#fff', color:s.getPropertyValue('--text').trim()||'#18231d', confirmButtonColor:s.getPropertyValue('--primary').trim()||'#16734f', cancelButtonColor:s.getPropertyValue('--border').trim()||'#e3e9e5' }; };

export async function confirmAction(title: string, text: string, confirmButtonText: string) {
  const result = await Swal.fire({
    ...baseOptions(), title, text, icon: 'warning', showCancelButton: true,
    confirmButtonText, cancelButtonText: 'Annuler', reverseButtons: true, focusCancel: true,
  });
  return result.isConfirmed;
}

export async function showSuccess(title: string, text: string) {
  return Swal.fire({ ...baseOptions(), title, text, icon: 'success', confirmButtonText: 'OK' });
}

export async function showError(title: string, text: string) {
  return Swal.fire({ ...baseOptions(), title, text, icon: 'error', confirmButtonText: 'OK' });
}
