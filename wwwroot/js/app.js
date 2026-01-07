document.addEventListener('DOMContentLoaded', function() {
    const photoInput = document.getElementById('photoInput');
    const preview = document.getElementById('preview');
    const previewImage = document.getElementById('previewImage');
    const removeBtn = document.getElementById('removeBtn');
    const submitBtn = document.getElementById('submitBtn');
    const uploadForm = document.getElementById('uploadForm');
    const messageDiv = document.getElementById('message');

    // Handle file selection
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showMessage('Bitte wählen Sie eine Bilddatei aus.', 'error');
                return;
            }

            // Validate file size (10MB)
            if (file.size > 10 * 1024 * 1024) {
                showMessage('Die Datei ist zu groß. Maximum 10MB erlaubt.', 'error');
                photoInput.value = '';
                return;
            }

            // Show preview
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                preview.classList.remove('hidden');
                submitBtn.disabled = false;
            };
            reader.readAsDataURL(file);
            hideMessage();
        }
    });

    // Handle remove button
    removeBtn.addEventListener('click', function() {
        photoInput.value = '';
        preview.classList.add('hidden');
        previewImage.src = '';
        submitBtn.disabled = true;
        hideMessage();
    });

    // Handle form submission
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const file = photoInput.files[0];
        if (!file) {
            showMessage('Bitte wählen Sie eine Datei aus.', 'error');
            return;
        }

        // Show loading state
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        submitBtn.disabled = true;

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Upload file
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(
                    `✅ ${data.message}<br><small>Datei: ${data.fileName}</small>`,
                    'success'
                );

                // Reset form after successful upload
                setTimeout(() => {
                    photoInput.value = '';
                    preview.classList.add('hidden');
                    previewImage.src = '';
                    hideMessage();
                }, 5000);
            } else {
                showMessage(`❌ ${data.error || 'Fehler beim Hochladen'}`, 'error');
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Upload error:', error);
            showMessage('❌ Netzwerkfehler. Bitte versuchen Sie es erneut.', 'error');
            submitBtn.disabled = false;
        } finally {
            // Hide loading state
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    });

    function showMessage(text, type) {
        messageDiv.innerHTML = text;
        messageDiv.className = `message ${type}`;
        messageDiv.classList.remove('hidden');
    }

    function hideMessage() {
        messageDiv.classList.add('hidden');
        messageDiv.className = 'message hidden';
    }

    // Prevent accidental page refresh
    window.addEventListener('beforeunload', function(e) {
        if (photoInput.files.length > 0 && !submitBtn.disabled) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});
