const form = document.getElementById("registrationForm");
const message = document.getElementById("formMessage");
const submitButton = form.querySelector("button[type='submit']");
const ageInput = document.getElementById("idade");
const guardianFields = document.getElementById("guardianFields");
const guardianName = document.getElementById("nomeResponsavel");
const guardianPhone = document.getElementById("telefoneResponsavel");
const retreatSelect = document.getElementById("jaFezRetiro");
const retreatField = document.getElementById("qualRetiroField");
const retreatName = document.getElementById("qualRetiro");

function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 2) {
        return digits ? `(${digits}` : "";
    }

    const areaCode = digits.slice(0, 2);
    const subscriber = digits.slice(2);
    if (digits.length <= 6) {
        return `(${areaCode}) ${subscriber}`;
    }

    const subscriberLength = digits.length > 10 ? 5 : 4;
    return `(${areaCode}) ${subscriber.slice(0, subscriberLength)}-${subscriber.slice(subscriberLength)}`;
}

document.querySelectorAll(".phone-input").forEach((input) => {
    input.addEventListener("input", () => {
        input.value = formatPhone(input.value);
    });
});

function updateGuardianFields() {
    const age = Number(ageInput.value);
    const isMinor = ageInput.value !== "" && age > 0 && age < 18;

    guardianFields.hidden = !isMinor;
    guardianName.required = isMinor;
    guardianPhone.required = isMinor;
    guardianName.disabled = !isMinor;
    guardianPhone.disabled = !isMinor;

    if (!isMinor) {
        guardianName.value = "";
        guardianPhone.value = "";
    }
}

ageInput.addEventListener("input", () => {
    updateGuardianFields();

    if (ageInput.validity.valid && message.dataset.validation === "age") {
        message.textContent = "";
        message.className = "form-message";
        delete message.dataset.validation;
    }
});

ageInput.addEventListener("invalid", () => {
    let error = "";

    if (ageInput.validity.rangeUnderflow) {
        error = "A inscrição é permitida somente para pessoas com 11 anos ou mais.";
    } else if (ageInput.validity.rangeOverflow) {
        error = "Informe uma idade de até 120 anos.";
    } else if (ageInput.validity.valueMissing) {
        error = "Informe a idade para continuar.";
    }

    if (error) {
        showMessage(error, "error");
        message.dataset.validation = "age";
    }
}, true);

updateGuardianFields();

function updateRetreatField() {
    const hasRetreated = retreatSelect.value === "Sim";

    retreatField.hidden = !hasRetreated;
    retreatName.disabled = !hasRetreated;

    if (!hasRetreated) {
        retreatName.value = "";
    }
}

retreatSelect.addEventListener("change", updateRetreatField);
updateRetreatField();

function showMessage(text, type) {
    message.textContent = text;
    message.className = `form-message ${type}`;
    delete message.dataset.validation;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.className = "form-message";

    const formData = new FormData(form);
    const registration = {
        nome: String(formData.get("nome")).trim(),
        idade: String(formData.get("idade")),
        nome_responsavel: String(formData.get("nome_responsavel") || "").trim() || null,
        telefone_responsavel: String(formData.get("telefone_responsavel") || "").trim() || null,
        telefone_participante: String(formData.get("telefone_participante")).trim(),
        ja_fez_retiro: String(formData.get("ja_fez_retiro")),
        qual_retiro: String(formData.get("qual_retiro") || "").trim(),
        restricao_saude: String(formData.get("restricao_saude")).trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
        const response = await fetch("/inscricao", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(registration)
        });

        let result;
        try {
            result = await response.json();
        } catch {
            showMessage("O servidor retornou uma resposta inválida. Tente novamente.", "error");
            return;
        }

        if (!response.ok) {
            showMessage(result.mensagem || "Não foi possível concluir a inscrição.", "error");
            return;
        }

        showMessage(result.mensagem || "Inscrição enviada com sucesso!", "success");
        form.reset();
        updateGuardianFields();
        updateRetreatField();
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
        showMessage("Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.", "error");
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Enviar inscrição <span aria-hidden="true">→</span>';
    }
});
