from django.db import models
from reservations.models import Reservation
from django.core.files.base import ContentFile
import qrcode
from io import BytesIO

class Ticket(models.Model):
    ESTADO_CHOICES = (('valido','Válido'),('usado','Usado'),('expirado','Expirado'))
    reserva = models.OneToOneField(Reservation, on_delete=models.CASCADE, related_name='ticket')
    qr_image = models.ImageField(upload_to='tickets/', blank=True, null=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='valido')
    fecha_emision = models.DateTimeField(auto_now_add=True)
    fecha_validacion = models.DateTimeField(blank=True, null=True)

    def generate_qr(self, data: str):
        qr = qrcode.QRCode(box_size=10, border=4)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        filename = f"ticket_{self.reserva.codigo_reserva}.png"
        self.qr_image.save(filename, ContentFile(buffer.getvalue()), save=False)
        buffer.close()

    def save(self, *args, **kwargs):
        if not self.qr_image:
            payload = {
                "codigo_reserva": str(self.reserva.codigo_reserva),
                "reserva_id": self.reserva.id,
            }
            import json
            self.generate_qr(json.dumps(payload))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Ticket {self.reserva.codigo_reserva}"
