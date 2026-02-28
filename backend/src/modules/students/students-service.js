const { ApiError, sendAccountVerificationEmail } = require("../../utils");
const { findAllStudents, findStudentDetail, findStudentToSetStatus, addOrUpdateStudent, findClassByName, findSectionByName } = require("./students-repository");
const { findUserById } = require("../../shared/repository");

const normalizeText = (value) => {
    if (typeof value !== "string") {
        return value ?? null;
    }
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
}

const normalizeStudentPayload = (payload = {}) => ({
    ...payload,
    userId: payload.userId ?? payload.id ?? null,
    class: normalizeText(payload.class ?? payload.className ?? payload.class_name ?? null),
    section: normalizeText(payload.section ?? payload.sectionName ?? payload.section_name ?? null),
    admissionDate: payload.admissionDate ?? payload.admission_dt ?? null,
    currentAddress: normalizeText(payload.currentAddress ?? payload.current_address ?? null),
    permanentAddress: normalizeText(payload.permanentAddress ?? payload.permanent_address ?? null),
    fatherName: normalizeText(payload.fatherName ?? payload.father_name ?? null),
    fatherPhone: normalizeText(payload.fatherPhone ?? payload.father_phone ?? null),
    motherName: normalizeText(payload.motherName ?? payload.mother_name ?? null),
    motherPhone: normalizeText(payload.motherPhone ?? payload.mother_phone ?? null),
    guardianName: normalizeText(payload.guardianName ?? payload.guardian_name ?? null),
    guardianPhone: normalizeText(payload.guardianPhone ?? payload.guardian_phone ?? null),
    relationOfGuardian: normalizeText(payload.relationOfGuardian ?? payload.relation_of_guardian ?? null),
    systemAccess: payload.systemAccess ?? payload.isActive ?? payload.is_active ?? null,
});

const getStudentMutationStatusCode = (message) => {
    if (message === "Email already exists") {
        return 409;
    }
    return 400;
}

const validateAndCanonicalizeClassAndSection = async (payload) => {
    const canonicalPayload = { ...payload };

    if (payload.class) {
        const matchedClass = await findClassByName(payload.class);
        if (!matchedClass) {
            throw new ApiError(400, `Invalid class '${payload.class}'. Class does not exist.`);
        }
        canonicalPayload.class = matchedClass.name;
    }

    if (payload.section) {
        const matchedSection = await findSectionByName(payload.section);
        if (!matchedSection) {
            throw new ApiError(400, `Invalid section '${payload.section}'. Section does not exist.`);
        }
        canonicalPayload.section = matchedSection.name;
    }

    return canonicalPayload;
}

const checkStudentId = async (id) => {
    const isStudentFound = await findUserById(id);
    if (!isStudentFound) {
        throw new ApiError(404, "Student not found");
    }
}

const getAllStudents = async (payload) => {
    const students = await findAllStudents(payload);
    if (students.length <= 0) {
        throw new ApiError(404, "Students not found");
    }

    return students;
}

const getStudentDetail = async (id) => {
    await checkStudentId(id);

    const student = await findStudentDetail(id);
    if (!student) {
        throw new ApiError(404, "Student not found");
    }

    return student;
}

const addNewStudent = async (payload) => {
    const ADD_STUDENT_AND_EMAIL_SEND_SUCCESS = "Student added and verification email sent successfully.";
    const ADD_STUDENT_AND_BUT_EMAIL_SEND_FAIL = "Student added, but failed to send verification email.";
    const normalizedPayload = await validateAndCanonicalizeClassAndSection(normalizeStudentPayload(payload));
    try {
        const result = await addOrUpdateStudent(normalizedPayload);
        if (!result.status) {
            const message = result.description
                ? `${result.message}. ${result.description}`
                : result.message;
            throw new ApiError(getStudentMutationStatusCode(result.message), message);
        }

        try {
            await sendAccountVerificationEmail({ userId: result.userId, userEmail: normalizedPayload.email });
            return { message: ADD_STUDENT_AND_EMAIL_SEND_SUCCESS };
        } catch (error) {
            return { message: ADD_STUDENT_AND_BUT_EMAIL_SEND_FAIL }
        }
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Unable to add student due to unexpected server error");
    }
}

const updateStudent = async (payload) => {
    const normalizedPayload = await validateAndCanonicalizeClassAndSection(normalizeStudentPayload(payload));
    await checkStudentId(normalizedPayload.userId);

    const result = await addOrUpdateStudent(normalizedPayload);
    if (!result.status) {
        const message = result.description
            ? `${result.message}. ${result.description}`
            : result.message;
        throw new ApiError(getStudentMutationStatusCode(result.message), message);
    }

    return { message: result.message };
}

const setStudentStatus = async ({ userId, reviewerId, status }) => {
    await checkStudentId(userId);

    const affectedRow = await findStudentToSetStatus({ userId, reviewerId, status });
    if (affectedRow <= 0) {
        throw new ApiError(500, "Unable to disable student");
    }

    return { message: "Student status changed successfully" };
}

module.exports = {
    getAllStudents,
    getStudentDetail,
    addNewStudent,
    setStudentStatus,
    updateStudent,
};
