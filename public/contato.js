const form = document.getElementById("formContato");
const telefone = document.getElementById("telefone");

telefone.addEventListener("input", () => {
    let digits = telefone.value.replace(/\D/g, "").slice(0, 11);

    if (digits.length > 10) {
        digits = digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
    } else if (digits.length > 6) {
        digits = digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (digits.length > 2) {
        digits = digits.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
    } else if (digits.length > 0) {
        digits = digits.replace(/^(\d{0,2}).*/, "($1");
    }

    telefone.value = digits;
    telefone.setCustomValidity("");
});

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const digits = telefone.value.replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 11) {
        telefone.setCustomValidity("Informe um WhatsApp com DDD e 10 ou 11 dígitos.");
        telefone.reportValidity();
        return;
    }

    const data = new FormData(form);
    const nome = String(data.get("nome")).trim();
    const mensagem = String(data.get("mensagem")).trim();
    const numeroContato = String(data.get("contato"));
    const texto = `Olá! Sou ${nome}, meu WhatsApp é ${telefone.value}. Tenho uma dúvida sobre o Luau — Te Buscarei: ${mensagem}`;
    const url = `https://wa.me/${numeroContato}?text=${encodeURIComponent(texto)}`;

    window.location.assign(url);
});
